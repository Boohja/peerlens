<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { ClientSession, tryRecoverSession } from '$lib/client-session';
	import { toast } from '$lib/toast';
	import { buildPhoneJoinUrl } from '$lib/webrtc/config';
	import ViewerLanding from '$lib/viewer/ViewerLanding.svelte';
	import ViewerQrPanel from '$lib/viewer/ViewerQrPanel.svelte';
	import ViewerStream from '$lib/viewer/ViewerStream.svelte';

	type ViewerStep = 'landing' | 'qr' | 'stream';

	let sessionId = $state('');
	let phoneJoinUrl = $state('');
	let status = $state('');
	let previousStatus = $state('');
	let blurCode = $state(false);
	let step = $state<ViewerStep>('landing');
	let videoFit = $state<'contain' | 'cover'>('contain');
	let fullscreen = $state(false);
	let remoteStream = $state<MediaStream | null>(null);
	let peer: RTCPeerConnection | null = null;
	let answerPollTimer: ReturnType<typeof setInterval> | null = null;
	let icePollTimer: ReturnType<typeof setInterval> | null = null;
	let lastIceId = 0;
	let pendingRemoteIce: RTCIceCandidateInit[] = [];
	let viewerWasConnected = false;
	const session = new ClientSession('viewer');

	async function flushPendingRemoteIce() {
		if (!peer || !peer.currentRemoteDescription || pendingRemoteIce.length === 0) {
			return;
		}

		const queued = pendingRemoteIce;
		pendingRemoteIce = [];

		for (const candidate of queued) {
			try {
				await peer.addIceCandidate(candidate);
			} catch (err) {
				console.error('Failed to add queued ICE candidate:', err);
			}
		}
	}

	function clearTimers() {
		if (answerPollTimer) {
			clearInterval(answerPollTimer);
			answerPollTimer = null;
		}

		if (icePollTimer) {
			clearInterval(icePollTimer);
			icePollTimer = null;
		}
	}

	function teardownPeer() {
		clearTimers();
		pendingRemoteIce = [];

		if (peer) {
			peer.onicecandidate = null;
			peer.ontrack = null;
			peer.onconnectionstatechange = null;
			peer.close();
			peer = null;
		}

		remoteStream = null;
	}

	$effect(() => {
		if (status === 'Disconnected' && previousStatus !== 'Disconnected') {
			toast('error', 'Camera disconnected');
		}

		previousStatus = status;
	});

	$effect(() => {
		if (step !== 'stream') fullscreen = false;
	});

	async function createApiError(response: Response, fallbackMessage: string): Promise<Error> {
		let message = fallbackMessage;

		try {
			const payload = (await response.json()) as { message?: unknown; retryAfterSeconds?: unknown };
			if (typeof payload.message === 'string' && payload.message.trim()) {
				message = payload.message.trim();
			}

			if (response.status === 429 && typeof payload.retryAfterSeconds === 'number') {
				const seconds = Math.max(1, Math.floor(payload.retryAfterSeconds));
				message = `${message} Retry in ${seconds}s.`;
			}
		} catch {
			if (response.status === 429) {
				message = 'Too many requests. Please wait a moment and try again.';
			}
		}

		return new Error(message);
	}

	function getErrorMessage(error: unknown, fallbackMessage: string): string {
		if (error instanceof Error && error.message.trim()) {
			return error.message.trim();
		}

		return fallbackMessage;
	}

	function stripIceCandidatesFromSdp(sdp: string): string {
		return sdp
			.replace(/^a=candidate:.*(?:\r?\n)?/gm, '')
			.replace(/^a=end-of-candidates(?:\r?\n)?/gm, '');
	}

	function handleRefreshSessionError(error: unknown) {
		const message = getErrorMessage(error, 'Could not create a new session');
		session.log(`refreshSession failed: ${message}`);
		status = message;
		toast('error', message);
	}

	function handleRecoverSessionError(error: unknown) {
		const message = getErrorMessage(error, 'Could not recover the previous session');
		session.log(`recoverSession failed: ${message}`);
		status = message;
		step = 'landing';
		toast('error', message);
	}

	async function createSession(): Promise<string> {
		session.log('POST /api/sessions');
		const response = await fetch('/api/sessions', { method: 'POST' });
		if (!response.ok) {
			throw await createApiError(response, 'Could not create signaling session');
		}

		const payload = (await response.json()) as { sessionId: string };
		if (!payload.sessionId) {
			throw new Error('Invalid signaling session response');
		}

		session.log(`session created: ${payload.sessionId}`);

		return payload.sessionId;
	}

	async function postDescription(id: string, type: 'offer' | 'answer', sdp: string) {
		session.log(`POST description ${type}`);
		const sanitizedSdp = stripIceCandidatesFromSdp(sdp);
		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ type, sdp: sanitizedSdp })
		});

		if (!response.ok) {
			throw await createApiError(response, 'Could not publish session description');
		}
	}

	async function postIceCandidate(id: string, role: 'viewer' | 'phone', candidate: RTCIceCandidate) {
		const payload = {
			candidate: {
				candidate: candidate.candidate,
				sdpMid: candidate.sdpMid,
				sdpMLineIndex: candidate.sdpMLineIndex,
				usernameFragment: candidate.usernameFragment
			},
			role
		};

		await fetch(`/api/sessions/${encodeURIComponent(id)}/ice`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	}

	async function markSessionAsConnected(id: string) {
		try {
			session.log('POST connected');
			await fetch(`/api/sessions/${encodeURIComponent(id)}/connected`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' }
			});
		} catch (err) {
			console.error('Failed to mark session as connected:', err);
			session.log(`POST connected failed: ${String(err)}`);
		}
	}

	async function pollAnswer(id: string) {
		if (!peer) return;

		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`);
		if (response.status === 404) {
			status = 'Session expired. Create a new session.';
			blurCode = true;
			step = 'qr';
			session.log('pollAnswer: session not found (404)');
			session.clear(id);
			sessionId = '';
			teardownPeer();
			return;
		}

		if (!response.ok) return;

		const payload = (await response.json()) as {
			answer: { type: 'answer'; sdp: string } | null;
		};

		if (!payload.answer || !peer || peer.currentRemoteDescription) {
			return;
		}

		await peer.setRemoteDescription({ type: payload.answer.type, sdp: payload.answer.sdp });
		await flushPendingRemoteIce();
		session.log('answer received and set as remote description');
		status = 'Answer received. Establishing stream...';
	}

	async function pollIce(id: string) {
		if (!peer) return;

		const response = await fetch(
			`/api/sessions/${encodeURIComponent(id)}/ice?for=viewer&after=${lastIceId}&limit=100`
		);
		if (response.status === 404) {
			status = 'Session expired. Create a new session.';
			blurCode = true;
			step = 'qr';
			session.log('pollIce: session not found (404)');
			session.clear(id);
			sessionId = '';
			teardownPeer();
			return;
		}

		if (!response.ok) return;

		const payload = (await response.json()) as {
			candidates: Array<{ candidate: RTCIceCandidateInit | null }>;
			nextAfter: number;
		};

		for (const item of payload.candidates) {
			if (!item.candidate) continue;

			if (!peer.currentRemoteDescription) {
				pendingRemoteIce.push(item.candidate);
				continue;
			}

			try {
				await peer.addIceCandidate(item.candidate);
			} catch (err) {
				console.error('Failed to add ICE candidate:', err);
			}
		}

		await flushPendingRemoteIce();

		lastIceId = payload.nextAfter;
	}

	function startPolling(id: string) {
		clearTimers();

		answerPollTimer = setInterval(() => {
			void pollAnswer(id);
		}, 1200);

		icePollTimer = setInterval(() => {
			void pollIce(id);
		}, 800);
	}

	async function setupPeerConnection(id: string) {
		peer = new RTCPeerConnection({ iceServers: [] });
		lastIceId = 0;
		pendingRemoteIce = [];

		peer.addTransceiver('video', { direction: 'recvonly' });

		peer.ontrack = (event) => {
			const [streamFromEvent] = event.streams;
			session.log(
				`ontrack: kind=${event.track.kind}, readyState=${event.track.readyState}, streams=${event.streams.length}`
			);

			if (streamFromEvent) {
				remoteStream = streamFromEvent;
				return;
			}

			if (!remoteStream) {
				remoteStream = new MediaStream();
			}

			remoteStream.addTrack(event.track);
		};

		peer.onicecandidate = (event) => {
			if (!event.candidate) return;
			console.log(event.candidate);
			void postIceCandidate(id, 'viewer', event.candidate);
		};

		peer.onconnectionstatechange = () => {
			if (!peer) return;

			if (peer.connectionState === 'connected') {
				clearTimers();
				viewerWasConnected = true;
				step = 'stream';
				status = 'Connected';
				session.log('peer connected');
				void session.setState('party', id);
				void markSessionAsConnected(id);
			} else if (peer.connectionState === 'failed') {
				step = 'qr';
				status = 'Disconnected';
				session.log('peer failed');
				viewerWasConnected = false;
				// Immediately tear down and post a new offer so the phone can reconnect
				teardownPeer();
				void setupPeerConnection(sessionId).catch(console.error);
			} else if (peer.connectionState === 'disconnected') {
				step = 'qr';
				status = 'Disconnected';
				session.log('peer disconnected');
				viewerWasConnected = false;
				teardownPeer();
				void setupPeerConnection(sessionId).catch(console.error);
			}
		};

		const offer = await peer.createOffer();
		await peer.setLocalDescription(offer);

		if (!peer.localDescription?.sdp) {
			throw new Error('Missing local offer SDP');
		}

		await postDescription(id, 'offer', peer.localDescription.sdp);
		void session.setState('offered', id);
		viewerWasConnected = false;
		step = 'qr';
		status = 'Waiting for phone to scan code...';
		startPolling(id);
	}

	async function refreshSession() {
		const previousSessionId = sessionId;
		step = 'qr';
		fullscreen = false;
		teardownPeer();
		if (previousSessionId) {
			await session.destroy(previousSessionId);
		}

		status = 'Creating session...';
		sessionId = await createSession();
		session.setSessionId(sessionId);
		session.log(`set local session identity: ${sessionId}`);
		const origin = window.location.origin;
		phoneJoinUrl = buildPhoneJoinUrl(sessionId, origin);
		blurCode = false;

		await setupPeerConnection(sessionId);
	}

	onMount(async () => {
		session.log('tryRecoverSession');
		const recovery = await tryRecoverSession();
		if (!recovery.ok) {
			if (recovery.reason === 'not-found') {
				session.log('session recovery failed: session not found');
			} else if (recovery.reason === 'viewer-left') {
				session.log('session recovery failed: viewer left');
			} else if (recovery.reason === 'request-failed') {
				session.log(
					`session recovery failed: request failed${recovery.status ? ` (HTTP ${recovery.status})` : ''}`
				);
			}
			return;
		}

		try {
			sessionId = recovery.session.sessionId;
			session.log(
				`session recovery passed; viewer_state=${recovery.session.viewerState ?? 'null'}; restore viewer`
			);
			const origin = window.location.origin;
			phoneJoinUrl = buildPhoneJoinUrl(sessionId, origin);
			blurCode = false;
			step = 'qr';
			status = 'Restoring session...';

			await setupPeerConnection(sessionId);
		} catch (error) {
			handleRecoverSessionError(error);
		}
	});

	onDestroy(() => {
		const currentSessionId = sessionId;
		teardownPeer();
		viewerWasConnected = false;
		void session.destroy(currentSessionId);
	});
</script>

<svelte:head>
	<title>PeerLens Viewer</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && fullscreen) fullscreen = false; }} />

<main class="content">
	{#if step === 'landing'}
		<ViewerLanding on:start={() => void refreshSession().catch(handleRefreshSessionError)} />
	{:else if step === 'qr'}
		<ViewerQrPanel
			{phoneJoinUrl}
			{status}
			{blurCode}
			on:renew={() => void refreshSession().catch(handleRefreshSessionError)}
			on:cancel={async () => {
				teardownPeer();
				viewerWasConnected = false;
				await session.destroy(sessionId);
				sessionId = '';
				phoneJoinUrl = '';
				status = '';
				blurCode = false;
				step = 'landing';
			}}
		/>
	{:else if step === 'stream'}
		<ViewerStream
			{remoteStream}
			{status}
			{fullscreen}
			{videoFit}
			on:fitchange={(event) => {
				videoFit = event.detail;
			}}
			on:fullscreenchange={(event) => {
				fullscreen = event.detail;
			}}
			on:retry={() => void refreshSession().catch(handleRefreshSessionError)}
		/>
	{/if}

</main>