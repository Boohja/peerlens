<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		appendSessionIdentityLog,
		clearSessionIdentity,
		clearSessionIdentityForSession,
		setSessionIdentity
	} from '$lib/session-identity';
	import { patchSessionRoleState } from '$lib/session-state';
	import { toast } from '$lib/toast';
	import { buildPhoneJoinUrl } from '$lib/webrtc/config';
	import ViewerLanding from '$lib/viewer/ViewerLanding.svelte';
	import ViewerQrPanel from '$lib/viewer/ViewerQrPanel.svelte';
	import ViewerStream from '$lib/viewer/ViewerStream.svelte';

	type ViewerStep = 'landing' | 'qr' | 'stream';

	let sessionId = $state('');
	let phoneJoinUrl = $state('');
	let qrCodeUrl = $state('');
	let status = $state('');
	let previousStatus = $state('');
	let blurCode = $state(false);
	let step = $state<ViewerStep>('landing');
	let videoFit = $state<'contain' | 'cover'>('contain');
	let fullscreen = $state(false);
	let remoteStream = $state<MediaStream | null>(null);
	let qrModulePromise: Promise<typeof import('qrcode')> | null = null;

	let peer: RTCPeerConnection | null = null;
	let answerPollTimer: ReturnType<typeof setInterval> | null = null;
	let icePollTimer: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let lastIceId = 0;
	let pendingRemoteIce: RTCIceCandidateInit[] = [];
	let viewerWasConnected = false;

	async function setViewerState(id: string, nextState: 'offered' | 'waiting' | 'party' | 'left') {
		appendSessionIdentityLog(`PATCH viewer_state -> ${nextState}`);
		await patchSessionRoleState(id, 'viewer', nextState);
	}

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

		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	}

	async function toQrDataUrl(value: string) {
		qrModulePromise ??= import('qrcode');
		const { toDataURL } = await qrModulePromise;
		return toDataURL(value, {
			width: 320,
			margin: 1,
			errorCorrectionLevel: 'M'
		});
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

	async function deleteSession(id: string) {
		if (!id) return;

		try {
			appendSessionIdentityLog(`DELETE /api/sessions/${id}`);
			await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
		} catch {
			// ignore best-effort cleanup failures
		}
	}

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

	function handleRefreshSessionError(error: unknown) {
		const message = getErrorMessage(error, 'Could not create a new session');
		appendSessionIdentityLog(`refreshSession failed: ${message}`);
		status = message;
		toast('error', message);
	}

	async function createSession(): Promise<string> {
		appendSessionIdentityLog('POST /api/sessions');
		const response = await fetch('/api/sessions', { method: 'POST' });
		if (!response.ok) {
			throw await createApiError(response, 'Could not create signaling session');
		}

		const payload = (await response.json()) as { sessionId: string };
		if (!payload.sessionId) {
			throw new Error('Invalid signaling session response');
		}

		appendSessionIdentityLog(`session created: ${payload.sessionId}`);

		return payload.sessionId;
	}

	async function postDescription(id: string, type: 'offer' | 'answer', sdp: string) {
		appendSessionIdentityLog(`POST description ${type}`);
		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ type, sdp })
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
			appendSessionIdentityLog('POST connected');
			await fetch(`/api/sessions/${encodeURIComponent(id)}/connected`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' }
			});
		} catch (err) {
			console.error('Failed to mark session as connected:', err);
			appendSessionIdentityLog(`POST connected failed: ${String(err)}`);
		}
	}

	async function pollAnswer(id: string) {
		if (!peer) return;

		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`);
		if (response.status === 404) {
			status = 'Session expired. Create a new session.';
			blurCode = true;
			step = 'qr';
			appendSessionIdentityLog('pollAnswer: session not found (404)');
			clearSessionIdentityForSession(id);
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
		appendSessionIdentityLog('answer received and set as remote description');
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
			appendSessionIdentityLog('pollIce: session not found (404)');
			clearSessionIdentityForSession(id);
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
			appendSessionIdentityLog(
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
				viewerWasConnected = true;
				if (reconnectTimer) {
					clearTimeout(reconnectTimer);
					reconnectTimer = null;
				}
				step = 'stream';
				status = 'Connected';
				appendSessionIdentityLog('peer connected');
				void setViewerState(id, 'party');
				void markSessionAsConnected(id);
			} else if (peer.connectionState === 'failed') {
				step = 'qr';
				status = 'Disconnected';
				appendSessionIdentityLog('peer failed');
				if (viewerWasConnected) {
					viewerWasConnected = false;
					void setViewerState(id, 'waiting');
				}
				// Immediately tear down and post a new offer so the phone can reconnect
				teardownPeer();
				void setupPeerConnection(sessionId).catch(console.error);
			} else if (peer.connectionState === 'disconnected') {
				step = 'qr';
				status = 'Disconnected';
				appendSessionIdentityLog('peer disconnected');
				if (viewerWasConnected) {
					viewerWasConnected = false;
					void setViewerState(id, 'waiting');
				}
				// Give ICE a short window to self-recover before forcing a new offer
				if (reconnectTimer) clearTimeout(reconnectTimer);
				const capturedSessionId = sessionId;
				reconnectTimer = setTimeout(() => {
					reconnectTimer = null;
					if (sessionId === capturedSessionId && sessionId) {
						teardownPeer();
						void setupPeerConnection(sessionId).catch(console.error);
					}
				}, 5000);
			}
		};

		const offer = await peer.createOffer();
		await peer.setLocalDescription(offer);

		if (!peer.localDescription?.sdp) {
			throw new Error('Missing local offer SDP');
		}

		await postDescription(id, 'offer', peer.localDescription.sdp);
		void setViewerState(id, 'offered');
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
			void setViewerState(previousSessionId, 'left');
			void deleteSession(previousSessionId);
		}

		status = 'Creating session...';
		sessionId = await createSession();
		setSessionIdentity(sessionId);
		appendSessionIdentityLog(`set local session identity: ${sessionId}`);
		const origin = window.location.origin;
		phoneJoinUrl = buildPhoneJoinUrl(sessionId, origin);
		qrCodeUrl = '';
		void toQrDataUrl(phoneJoinUrl)
			.then((value) => {
				qrCodeUrl = value;
			})
			.catch((err) => {
				console.error(err);
			});
		blurCode = false;

		await setupPeerConnection(sessionId);
	}

	onDestroy(() => {
		const currentSessionId = sessionId;
		teardownPeer();
		viewerWasConnected = false;
		clearSessionIdentity();
		if (currentSessionId) {
			void setViewerState(currentSessionId, 'left');
			void deleteSession(currentSessionId);
		}
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
			{qrCodeUrl}
			{phoneJoinUrl}
			{status}
			{blurCode}
			on:renew={() => void refreshSession().catch(handleRefreshSessionError)}
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