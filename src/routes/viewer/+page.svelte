<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		appendSessionIdentityLog,
		clearSessionIdentity,
		clearSessionIdentityForSession,
		setSessionIdentity
	} from '$lib/session-identity';
	import { patchSessionRoleState } from '$lib/session-state';
	import { toast } from '$lib/toast';
	import { buildPhoneJoinUrl, isPublicHostConfigured } from '$lib/webrtc/config';

	let sessionId = $state('');
	let phoneJoinUrl = $state('');
	let qrCodeUrl = $state('');
	let status = $state('Idle');
	let previousStatus = $state('Idle');
	let blurCode = $state(false);
	let tab = $state<'code' | 'stream'>('code');
	let videoFit = $state<'contain' | 'cover'>('contain');
	let fullscreen = $state(false);
	let remoteVideoEl = $state<HTMLVideoElement | undefined>(undefined);
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

		if (remoteVideoEl) {
			remoteVideoEl.srcObject = null;
		}
		tab = 'code';
	}

	$effect(() => {
		if (status === 'Disconnected' && previousStatus !== 'Disconnected') {
			toast('error', 'Camera disconnected');
		}

		previousStatus = status;
	});

	$effect(() => {
		if (tab !== 'stream') fullscreen = false;
	});

	$effect(() => {
		if (!remoteVideoEl) {
			return;
		}

		if (remoteStream && remoteVideoEl.srcObject !== remoteStream) {
			remoteVideoEl.srcObject = remoteStream;
			void remoteVideoEl.play().catch((err) => {
				appendSessionIdentityLog(`video play() rejected: ${String(err)}`);
			});
		} else if (!remoteStream && remoteVideoEl.srcObject) {
			remoteVideoEl.srcObject = null;
		}
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

	async function createSession(): Promise<string> {
		appendSessionIdentityLog('POST /api/sessions');
		const response = await fetch('/api/sessions', { method: 'POST' });
		if (!response.ok) {
			throw new Error('Could not create signaling session');
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
			throw new Error('Could not publish session description');
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
				tab = 'stream';
				status = 'Connected';
				appendSessionIdentityLog('peer connected');
				void setViewerState(id, 'party');
				void markSessionAsConnected(id);
			} else if (peer.connectionState === 'failed') {
				tab = 'code';
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
				tab = 'code';
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
		status = 'Waiting for phone to scan code...';
		startPolling(id);
	}

	async function refreshSession() {
		const previousSessionId = sessionId;
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

	onMount(() => {
		void refreshSession().catch((err) => {
			console.error(err);
			appendSessionIdentityLog(`viewer init failed: ${String(err)}`);
			status = 'Could not initialize viewer session';
		});
	});

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
	<title>Viewer Session</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && fullscreen) fullscreen = false; }} />

<main class="content">

	{#if tab === 'stream'}
		<div class="video-wrap" class:fullscreen>
			<div class="video-controls">
				<button
					type="button"
					class:active={videoFit === 'cover'}
					onclick={() => { videoFit = 'cover'; fullscreen = true; }}
					title="Fill width — crops top and bottom"
				>
					<svg viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<rect x="0" y="0" width="20" height="12" rx="1" fill="currentColor" opacity="0.25"/>
						<rect x="5" y="0" width="10" height="12" rx="1" fill="currentColor"/>
						<line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 2" opacity="0.6"/>
						<line x1="0" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 2" opacity="0.6"/>
					</svg>
					Fill width
				</button>
				<button
					type="button"
					class:active={videoFit === 'contain'}
					onclick={() => { videoFit = 'contain'; fullscreen = true; }}
					title="Fit height — black bars on sides"
				>
					<svg viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<rect x="0" y="0" width="20" height="12" rx="1" fill="currentColor" opacity="0.25"/>
						<rect x="7" y="0" width="6" height="12" rx="1" fill="currentColor"/>
					</svg>
					Fit height
				</button>
				{#if fullscreen}
					<button
						type="button"
						class="close-btn"
						onclick={() => (fullscreen = false)}
						title="Exit fullscreen"
					>✕</button>
				{/if}
			</div>
			<video
				bind:this={remoteVideoEl}
				autoplay
				muted
				playsinline
				class="remote-video"
				class:fit-cover={videoFit === 'cover'}
			></video>
			<p class="status">{status}</p>

			{#if status === 'Disconnected'}
				<button class="btn btn-viewer" type="button" onclick={refreshSession}>Retry</button>
			{/if}
		</div>

  {:else if tab === 'code'}
    <div class="card">
      <p>Scan this QR code from your phone to connect with this device.</p>
      <div class="qr-wrap {blurCode ? 'blur' : ''}">
				{#if qrCodeUrl}
					<img src={qrCodeUrl} alt="QR code for phone join URL" class="qr-image" />
					<a class="text-xs -mt-3 opacity-45" href={phoneJoinUrl} target="_blank" rel="noopener noreferrer">
						{phoneJoinUrl}
					</a>
				{:else}
					<p>Generating QR code...</p>
				{/if}
      </div>

      <div class="details">
        <p><strong>Status:</strong> {status}</p>
      </div>

			<button class="btn btn-viewer" type="button" onclick={refreshSession}>New session</button>
    </div>

    {#if !isPublicHostConfigured()}
      <div class="card">
        Tip: set <code>PUBLIC_APP_HOST</code> (for example, your LAN IP origin) so phones on the
        same network can open the correct host URL.
      </div>
    {/if}
  {/if}

</main>

<style>
	p {
		margin: 0;
	}

	.qr-wrap {
		display: grid;
		place-items: center;
	}

	.video-wrap {
		position: relative;
	}

	.video-wrap.fullscreen {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: #000;
	}

	.video-controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.video-wrap.fullscreen .video-controls {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1;
		margin-bottom: 0;
		padding: 0.75rem;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
	}

	.video-controls button {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid rgba(92, 92, 92, 0.2);
		background: rgba(15, 15, 15, 0.08);
		color: #1d1d1d;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.video-controls button.active {
		background: rgba(117, 117, 117, 0.25);
		border-color: rgba(85, 85, 85, 0.5);
	}

  .fullscreen .video-controls button {
    border: 1px solid rgba(92, 92, 92, 0.2);
		background: rgba(43, 43, 43, 0.4);
    color: #bbbbbb;
    text-shadow: 0 0 5px rgba(3, 3, 3, 0.7);
  }

  .fullscreen .video-controls button.active {
		border-color: rgba(189, 189, 189, 0.5);
	}

	.video-controls svg {
		width: 1.25rem;
		height: 0.75rem;
		flex-shrink: 0;
	}

	.close-btn {
		margin-left: auto;
		font-size: 1.1rem;
		line-height: 1;
	}

	.remote-video {
		width: 100%;
		height: 80vh;
		background: #000;
		border-radius: 0.75rem;
		object-fit: contain;
	}

	.remote-video.fit-cover {
		object-fit: cover;
	}

	.video-wrap.fullscreen .remote-video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: 0;
	}

	.video-wrap.fullscreen .btn {
		position: absolute;
		bottom: 3.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
	}

	.qr-image {
		width: min(320px, 100%);
		height: auto;
		border-radius: 0.75rem;
		background: white;
		padding: 0.75rem;
    margin: 1rem;
	}

	.details {
		display: grid;
		gap: 0.35rem;
		word-break: break-word;
    margin-bottom: 1rem;
	}

	button {
		padding: 0.7rem 1rem;
		border: 0;
		border-radius: 0.6rem;
		font: inherit;
		cursor: pointer;
	}

	.status {
		color: #d8ffd8;
	}

	.blur {
		filter: blur(8px);
	}

</style>