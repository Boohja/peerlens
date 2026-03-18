<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { appendSessionIdentityLog, clearSessionIdentityForSession } from '$lib/session-identity';
	import { patchSessionRoleState } from '$lib/session-state';

	const dispatch = createEventDispatcher<{ cancel: void }>();
	export let sessionId = '';

	let videoEl: HTMLVideoElement;
	let stream: MediaStream | null = null;
	let error = '';
	let started = false;
	let signalingStatus = 'Idle';
	let loadingCameras = false;
	let cameras: MediaDeviceInfo[] = [];
	let selectedCameraId = '';

	let peer: RTCPeerConnection | null = null;
	let icePollTimer: ReturnType<typeof setInterval> | null = null;
	let lastIceId = 0;
	let lastOfferUpdatedAt = 0;
	let phonePublishedAnswer = false;
	let gatheredLocalCandidates: RTCIceCandidate[] = [];
	let rejectedPublicIpv6Candidates: RTCIceCandidate[] = [];
	let publicIpv6PromptHandled = false;
	let showIpv6FallbackModal = false;

	let idleOverlay = false;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	const IDLE_TIMEOUT_MS = 10_000;

	async function setPhoneState(nextState: 'waiting' | 'party') {
		if (!sessionId) return;
		appendSessionIdentityLog(`PATCH phone_state -> ${nextState}`);
		await patchSessionRoleState(sessionId, 'phone', nextState);
	}

	function wakeFromIdle(event: PointerEvent) {
		event.preventDefault();
		event.stopPropagation();
	}

	function wakeFromIdleClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		resetIdleTimer();
	}

	function resetIdleTimer() {
		if (idleTimer) clearTimeout(idleTimer);
		idleOverlay = false;
		void syncPreviewPlayback();
		idleTimer = setTimeout(() => {
			idleOverlay = true;
			void syncPreviewPlayback();
		}, IDLE_TIMEOUT_MS);
	}

	function clearIdleTimer() {
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	}

	async function syncPreviewPlayback() {
		if (!videoEl || !started) return;

		if (idleOverlay) {
			videoEl.pause();
			return;
		}

		try {
			await videoEl.play();
		} catch {
			// ignore failed play attempts caused by browser autoplay state changes
		}
	}

	function streamConstraints() {
		return {
			video: selectedCameraId
				? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
				: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
			audio: false
		} as MediaStreamConstraints;
	}

	function setCameraError(err: unknown) {
		if (err instanceof DOMException) {
			switch (err.name) {
				case 'NotAllowedError':
					error = 'Camera permission was denied.';
					break;
				case 'NotFoundError':
					error = 'No camera was found.';
					break;
				case 'NotReadableError':
					error = 'Camera is already in use or could not be started.';
					break;
				case 'OverconstrainedError':
					error = 'Requested camera settings are not supported.';
					break;
				default:
					error = `Camera error: ${err.name}`;
			}
		} else {
			error = 'Unknown camera error: ' + String(err);
		}
	}

	function clearSignalingTimer() {
		if (icePollTimer) {
			clearInterval(icePollTimer);
			icePollTimer = null;
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

	function isRateLimitError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false;
		}

		return /too many requests|retry in/i.test(error.message);
	}

	function extractCandidateAddress(candidateLine: string): string | null {
		const parts = candidateLine.trim().split(/\s+/);
		if (parts.length < 6) return null;
		return parts[4] ?? null;
	}

	function isPrivateIpv4Address(address: string): boolean {
		const match = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
		if (!match) return false;

		const octets = match.slice(1).map((part) => Number(part));
		if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;

		const [first, second] = octets;
		if (first === 10) return true;
		if (first === 192 && second === 168) return true;
		if (first === 172 && second >= 16 && second <= 31) return true;
		if (first === 169 && second === 254) return true;

		return false;
	}

	function isLocalAddress(address: string): boolean {
		const normalized = address.toLowerCase();

		if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.local')) {
			return true;
		}

		if (isPrivateIpv4Address(normalized)) {
			return true;
		}

		if (normalized.includes(':')) {
			if (normalized.startsWith('fe80:')) return true;
			if (/^f[c-d][0-9a-f]{0,2}:/i.test(normalized)) return true;
		}

		return false;
	}

	function isPublicIpv6Address(address: string): boolean {
		const normalized = address.toLowerCase();
		if (!normalized.includes(':')) return false;
		if (isLocalAddress(normalized)) return false;
		return /^[23][0-9a-f]{0,3}:/i.test(normalized);
	}

	function stopPeerConnection() {
		clearSignalingTimer();
		if (!peer) return;

		peer.onicecandidate = null;
		peer.onconnectionstatechange = null;
		peer.close();
		peer = null;
		lastIceId = 0;
	}

	function openImplicationsPage() {
		window.open('/ipv6', '_blank', 'noopener,noreferrer');
	}

	function stopForRejectedIpv6Fallback() {
		appendSessionIdentityLog('user rejected public IPv6 fallback candidate; stopping phone stream');
		error = 'Connection stopped because only public IPv6 was available and not approved.';
		signalingStatus = 'Stopped';
		showIpv6FallbackModal = false;
		stopCamera();
	}

	function confirmIpv6FallbackCandidate() {
		const fallbackCandidate = rejectedPublicIpv6Candidates[0];
		if (!fallbackCandidate) {
			showIpv6FallbackModal = false;
			stopForRejectedIpv6Fallback();
			return;
		}

		appendSessionIdentityLog('user accepted public IPv6 fallback candidate');
		signalingStatus = 'Connecting (public IPv6 fallback approved)...';
		showIpv6FallbackModal = false;
		void publishAnswerAndCandidates([fallbackCandidate]);
	}

	async function publishAnswerAndCandidates(candidates: RTCIceCandidate[]) {
		if (!peer?.localDescription?.sdp) {
			appendSessionIdentityLog('publishAnswerAndCandidates: missing local SDP');
			return;
		}

		try {
			await postDescription(sessionId, 'answer', peer.localDescription.sdp);
		} catch (err) {
			console.error('Failed to post answer:', err);
			appendSessionIdentityLog(`postDescription failed: ${String(err)}`);
			signalingStatus = err instanceof Error ? err.message : 'Could not publish answer';
			return;
		}

		phonePublishedAnswer = true;
		void setPhoneState('waiting');
		appendSessionIdentityLog('answer published; waiting for connection');
		signalingStatus = 'Answer published. Connecting...';

		for (const candidate of candidates) {
			void postIceCandidate(sessionId, 'phone', candidate).catch((err) => {
				console.error('Failed to publish phone ICE candidate:', err);
				appendSessionIdentityLog(`postIceCandidate failed: ${String(err)}`);
				if (err instanceof Error && isRateLimitError(err)) {
					signalingStatus = err.message;
				}
			});
		}

		startIcePolling(sessionId);
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
		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/ice`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				role,
				candidate: {
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex,
					usernameFragment: candidate.usernameFragment
				}
			})
		});

		if (!response.ok) {
			throw await createApiError(response, 'Could not publish ICE candidate');
		}
	}

	async function markSessionAsConnected(id: string) {
		try {
			appendSessionIdentityLog('POST connected');
			const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/connected`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' }
			});

			if (!response.ok) {
				throw await createApiError(response, 'Could not mark session as connected');
			}
		} catch (err) {
			console.error('Failed to mark session as connected:', err);
			appendSessionIdentityLog(`POST connected failed: ${String(err)}`);
			if (err instanceof Error && isRateLimitError(err)) {
				signalingStatus = err.message;
			}
		}
	}

	async function fetchOffer(id: string): Promise<{ sdp: string; updatedAt: number } | null> {
		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`);

		if (response.status === 404) {
			throw new Error('Session expired or missing');
		}

		if (response.status === 429) {
			throw await createApiError(response, 'Too many requests while waiting for viewer offer');
		}

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as {
			offer: { type: 'offer'; sdp: string } | null;
			updatedAt: number;
		};

		const sdp = payload.offer?.sdp || null;
		if (!sdp) return null;
		return { sdp, updatedAt: payload.updatedAt ?? 0 };
	}

	async function pollViewerIce(id: string) {
		if (!peer) return;

		const response = await fetch(
			`/api/sessions/${encodeURIComponent(id)}/ice?for=phone&after=${lastIceId}&limit=100`
		);
		if (response.status === 404) {
			signalingStatus = 'Session expired';
			appendSessionIdentityLog('pollViewerIce: session not found (404)');
			clearSessionIdentityForSession(id);
			stopPeerConnection();
			return;
		}

		if (response.status === 429) {
			const err = await createApiError(response, 'Too many requests while syncing ICE');
			signalingStatus = err.message;
			appendSessionIdentityLog(`pollViewerIce: rate limited (${err.message})`);
			return;
		}

		if (!response.ok) {
			return;
		}

		const payload = (await response.json()) as {
			candidates: Array<{ candidate: RTCIceCandidateInit | null }>;
			nextAfter: number;
		};

		for (const item of payload.candidates) {
			if (!item.candidate) continue;
			await peer.addIceCandidate(item.candidate);
		}

		lastIceId = payload.nextAfter;
	}

	function startIcePolling(id: string) {
		clearSignalingTimer();
		icePollTimer = setInterval(() => {
			void pollViewerIce(id);
		}, 800);
	}

	// newerThan: unix-seconds timestamp; only accept offers with updatedAt > newerThan.
	// Pass 0 on first connect (accept any offer), pass lastOfferUpdatedAt on reconnect
	// so the phone won't consume the old offer before the viewer posts a fresh one.
	async function waitForOffer(
		id: string,
		newerThan = 0,
		timeoutMs = 30000
	): Promise<{ sdp: string; updatedAt: number }> {
		const start = Date.now();

		while (Date.now() - start < timeoutMs) {
			const result = await fetchOffer(id);
			if (result && result.updatedAt > newerThan) {
				return result;
			}

			await new Promise((resolve) => setTimeout(resolve, 700));
		}

		throw new Error('Timed out waiting for viewer offer');
	}

	async function startSignaling(mediaStream: MediaStream, newerThan = 0) {
		if (!sessionId) return;

		stopPeerConnection();
		phonePublishedAnswer = false;
		gatheredLocalCandidates = [];
		rejectedPublicIpv6Candidates = [];
		publicIpv6PromptHandled = false;
		showIpv6FallbackModal = false;
		signalingStatus = 'Waiting for viewer offer...';
		appendSessionIdentityLog(`start signaling (newerThan=${newerThan})`);

		const { sdp: offerSdp, updatedAt: offerUpdatedAt } = await waitForOffer(sessionId, newerThan);
		lastOfferUpdatedAt = offerUpdatedAt;
		peer = new RTCPeerConnection({ iceServers: [] });
		lastIceId = 0;

		for (const track of mediaStream.getTracks()) {
			peer.addTrack(track, mediaStream);
		}

		peer.onicecandidate = (event) => {
			if (!event.candidate) {
				if (publicIpv6PromptHandled) return;

				if (gatheredLocalCandidates.length > 0) {
					void publishAnswerAndCandidates(gatheredLocalCandidates);
				} else if (rejectedPublicIpv6Candidates.length > 0) {
					publicIpv6PromptHandled = true;
					signalingStatus = 'Public IPv6 found. Waiting for your decision...';
					showIpv6FallbackModal = true;
				} else {
					signalingStatus = 'No local address found.';
					error = 'Could not find any local network address to use for the connection.';
				}

				return;
			}

			const address = extractCandidateAddress(event.candidate.candidate);
			if (!address) {
				appendSessionIdentityLog('rejected ICE candidate: unable to parse address');
				return;
			}

			// if (isLocalAddress(address)) {
			// 	gatheredLocalCandidates.push(event.candidate);
			// 	return;
			// }

			if (isPublicIpv6Address(address)) {
				rejectedPublicIpv6Candidates.push(event.candidate);
				appendSessionIdentityLog(`rejected public IPv6 ICE candidate (${address})`);
				return;
			}

			appendSessionIdentityLog(`rejected non-local ICE candidate (${address})`);
		};

		peer.onconnectionstatechange = () => {
			if (!peer) return;

			if (peer.connectionState === 'connected') {
				signalingStatus = 'Connected';
				clearSignalingTimer();
				appendSessionIdentityLog('peer connected');
				void setPhoneState('party');
				void markSessionAsConnected(sessionId);
				resetIdleTimer();
			} else if (peer.connectionState === 'failed') {
				// Peer failed — restart signaling. Require an offer newer than the one
				// we last used so the phone waits for the viewer to post a fresh offer.
				signalingStatus = 'Reconnecting...';
				appendSessionIdentityLog('peer failed; reconnecting');
				if (phonePublishedAnswer) {
					void setPhoneState('waiting');
				}
				if (stream && started) {
					const newerThan = lastOfferUpdatedAt;
					const reconnectStream = stream;
					void startSignaling(reconnectStream, newerThan).catch((err) => {
						console.error('Reconnect failed:', err);
						appendSessionIdentityLog(`reconnect failed: ${String(err)}`);
						signalingStatus = 'Disconnected';
					});
				}
			} else if (peer.connectionState === 'disconnected') {
				if (phonePublishedAnswer) {
					void setPhoneState('waiting');
				}
				appendSessionIdentityLog('peer disconnected');
				signalingStatus = 'Disconnected';
			}
		};

		await peer.setRemoteDescription({ type: 'offer', sdp: offerSdp });
		const answer = await peer.createAnswer();
		await peer.setLocalDescription(answer);

		if (!peer.localDescription?.sdp) {
			throw new Error('Missing local answer SDP');
		}

		signalingStatus = 'Gathering local addresses...';
		appendSessionIdentityLog('local description set; gathering ICE candidates');
		// Answer and candidates are published from onicecandidate once gathering completes
	}

	async function loadCameras(preferredDeviceId = '') {
		if (!navigator.mediaDevices?.enumerateDevices) {
			cameras = [];
			return;
		}

		loadingCameras = true;

		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			cameras = devices.filter((d) => d.kind === 'videoinput');
			const requestedId = preferredDeviceId || selectedCameraId;

			if (requestedId && cameras.some((c) => c.deviceId === requestedId)) {
				selectedCameraId = requestedId;
			} else if (!cameras.some((c) => c.deviceId === selectedCameraId)) {
				selectedCameraId = cameras[0]?.deviceId ?? '';
			}
		} catch (err) {
			console.error(err);
			error = 'Could not list available cameras.';
		} finally {
			loadingCameras = false;
		}
	}

	export async function startCamera() {
		error = '';
		signalingStatus = 'Starting camera...';
		stopCamera();

		try {
			stream = await navigator.mediaDevices.getUserMedia(streamConstraints());
			appendSessionIdentityLog('camera started');

			videoEl.srcObject = stream;
			await videoEl.play();
			started = true;

			const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? '';
			await loadCameras(activeId);

			if (sessionId) {
				await startSignaling(stream);
			} else {
				signalingStatus = 'Missing session';
				appendSessionIdentityLog('missing session id while starting signaling');
			}
		} catch (err) {
			console.error(err);
			appendSessionIdentityLog(`startCamera failed: ${String(err)}`);

			if (err instanceof Error && err.message === 'Session expired or missing') {
				clearSessionIdentityForSession(sessionId);
			}

			if (err instanceof Error && err.message.trim()) {
				error = err.message.trim();
				signalingStatus = err.message.trim();
			} else {
				setCameraError(err);
				signalingStatus = 'Not connected';
			}
		}
	}

	async function switchCamera() {
		error = '';

		if (!started) {
			await startCamera();
			return;
		}

		const previousStream = stream;
		signalingStatus = 'Switching camera...';

		try {
			const nextStream = await navigator.mediaDevices.getUserMedia(streamConstraints());
			const nextTrack = nextStream.getVideoTracks()[0];

			if (!nextTrack) {
				for (const track of nextStream.getTracks()) track.stop();
				throw new Error('No video track available for selected camera');
			}

			if (peer) {
				const videoSender = peer.getSenders().find((sender) => sender.track?.kind === 'video');
				if (videoSender) {
					await videoSender.replaceTrack(nextTrack);
				} else {
					peer.addTrack(nextTrack, nextStream);
				}
			}

			stream = nextStream;
			videoEl.srcObject = nextStream;
			await videoEl.play();

			if (previousStream) {
				for (const track of previousStream.getTracks()) track.stop();
			}

			const activeId = nextTrack.getSettings().deviceId ?? '';
			await loadCameras(activeId);

			signalingStatus = peer?.connectionState === 'connected' ? 'Connected' : 'Connecting...';
		} catch (err) {
			console.error(err);
			setCameraError(err);
			signalingStatus = peer?.connectionState === 'connected' ? 'Connected' : 'Not connected';
		}
	}

	export function stopCamera() {
		stopPeerConnection();
		if (sessionId && phonePublishedAnswer) {
			void setPhoneState('waiting');
		}
		phonePublishedAnswer = false;
		showIpv6FallbackModal = false;
		clearIdleTimer();
		lastOfferUpdatedAt = 0;
		signalingStatus = 'Stopped';
		if (stream) {
			for (const track of stream.getTracks()) track.stop();
			stream = null;
		}
		if (videoEl) videoEl.srcObject = null;
		started = false;
	}

	async function onCameraChange(event: Event) {
		selectedCameraId = (event.currentTarget as HTMLSelectElement).value;
		if (started) await switchCamera();
	}

	onMount(() => {
		const onDeviceChange = () => {
			if (started || cameras.length > 0) void loadCameras();
		};

		// When the phone comes back from background: if the camera track was killed
		// by the OS, do a full camera restart; if the track is still alive but the
		// peer failed/disconnected, restart signaling with a fresh offer requirement.
		const onVisibilityChange = () => {
			if (document.hidden || !started) return;
			const videoTrack = stream?.getVideoTracks()[0];
			if (videoTrack && videoTrack.readyState === 'ended') {
				void startCamera();
			} else if (peer && (peer.connectionState === 'failed' || peer.connectionState === 'disconnected')) {
				const newerThan = lastOfferUpdatedAt;
				const reconnectStream = stream;
				if (reconnectStream) {
					void startSignaling(reconnectStream, newerThan).catch((err) => {
						console.error('Visibility reconnect failed:', err);
						signalingStatus = 'Disconnected';
					});
				}
			}
		};

		navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
		document.addEventListener('visibilitychange', onVisibilityChange);
		void startCamera();

		return () => {
			navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	onDestroy(() => {
		stopCamera();
	});
</script>

{#if idleOverlay}
	<div
		class="idle-overlay"
		role="presentation"
		on:pointerdown|preventDefault|stopPropagation={wakeFromIdle}
		on:pointerup|preventDefault|stopPropagation
		on:click|preventDefault|stopPropagation={wakeFromIdleClick}
	>
		<p class="idle-hint">Power saving. Touch to wake up.</p>
	</div>
{/if}

<div class="camera-stream">
	<div class="preview-column">
		<video bind:this={videoEl} autoplay muted playsinline class="preview" class:preview-hidden={idleOverlay}></video>
	</div>

	<div class="content-column">
		<p class="preview-note">This stream is sent to the viewer.</p>
		<p class="status">Status: {signalingStatus}</p>

		{#if cameras.length > 1}
			<div class="camera-picker">
				<label for="camera-select">Camera</label>
				<select
					id="camera-select"
					class="select-phone"
					bind:value={selectedCameraId}
					on:change={onCameraChange}
					disabled={loadingCameras}
				>
					{#each cameras as camera, index}
						<option value={camera.deviceId}>
							{camera.label || `Camera ${index + 1}`}
						</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="actions">
			{#if started}
				<button
					class="btn btn-phone"
					on:click={() => {
						if (sessionId && phonePublishedAnswer) {
							void patchSessionRoleState(sessionId, 'phone', 'waiting');
						}
						stopCamera();
					}}
					disabled={!started}
				>
					Pause
				</button>
			{:else}
				<button class="btn btn-phone" on:click={() => void startCamera()} disabled={started}>Restart</button>
			{/if}
			<button
				class="btn btn-phone"
				on:click={() => {
					if (sessionId) {
						void patchSessionRoleState(sessionId, 'phone', 'left');
					}
					stopCamera();
					dispatch('cancel');
				}}
			>
				Leave
			</button>
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}
	</div>
</div>

{#if showIpv6FallbackModal}
	<div class="modal-backdrop" role="presentation">
		<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="ipv6-modal-title">
			<h3 id="ipv6-modal-title">Allow public IPv6 for setup?</h3>
			<p>
				Your phone did not provide a local-only IP, but it found a public IPv6 address.
			</p>
			<p>
				That address is exposed only during session setup. You can review details before deciding.
			</p>
			<div class="modal-actions">
				<button class="btn btn-phone block" type="button" on:click={openImplicationsPage}>
					<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 16V11.5" />
						<path d="M12 8.01172V8.00172" />
					</svg>
					See implications
				</button>
				<button class="btn btn-phone" type="button" on:click={confirmIpv6FallbackCandidate}>
					<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<path d="M17 3.33782C15.5291 2.48697 13.8214 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 11.3151 21.9311 10.6462 21.8 10" />
						<path d="M8 12.5C8 12.5 9.5 12.5 11.5 16C11.5 16 17.0588 6.83333 22 5" />
					</svg>
					Confirm IPv6
				</button>
				<button class="btn btn-phone" type="button" on:click={stopForRejectedIpv6Fallback}>
					<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="#141B34" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 21.5H12H12C16.4783 21.5 18.7175 21.5 20.1088 20.1088C21.5 18.7175 21.5 16.4783 21.5 12V12V12C21.5 7.52165 21.5 5.28248 20.1088 3.89124C18.7175 2.5 16.4783 2.5 12 2.5C7.52166 2.5 5.28249 2.5 3.89124 3.89124C2.5 5.28249 2.5 7.52166 2.5 12C2.5 16.4783 2.5 18.7175 3.89124 20.1088C5.28248 21.5 7.52165 21.5 12 21.5Z" />
						<path d="M15 9L9 14.9996M15 15L9 9.00039" />
					</svg>
					Stop
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.camera-stream {
		display: grid;
		grid-template-columns: minmax(0, auto) minmax(0, 1fr);
		align-items: start;
		gap: 1rem;
		-webkit-text-size-adjust: 100%;
		text-size-adjust: 100%;
	}

	.preview-column,
	.content-column {
		min-width: 0;
	}

	.camera-picker {
		display: grid;
		gap: 0.5rem;
		width: 100%;
	}

	.camera-picker label {
		font-size: 0.9rem;
	}

	.camera-picker select {
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		font: inherit;
		font-size: 16px;
		border: 1px solid;
		cursor: pointer;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-phone {
		background: var(--phone-bg);
		border-color: #a1736b;
	}

	.idle-overlay {
		position: fixed;
		inset: 0;
		background: #000;
		z-index: 200;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: max(2.5rem, env(safe-area-inset-bottom));
	}

	.idle-hint {
		margin: 0;
		color: #fff;
		font-size: 0.95rem;
		text-align: center;
		opacity: 1;
		animation: idle-hint-fade 3s ease-in forwards;
	}

	@keyframes idle-hint-fade {
		0%   { opacity: 1; }
		60%  { opacity: 1; }
		100% { opacity: 0.3; }
	}

	.preview {
		height: clamp(140px, 28vh, 220px);
		width: auto;
		max-width: min(46vw, 220px);
		background: #000;
		border-radius: 0.75rem;
		object-fit: contain;
	}

	.preview-hidden {
		visibility: hidden;
		width: 0;
		height: 0;
		overflow: hidden;
		margin: 0;
		padding: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.actions :global(.btn) {
		font-size: 16px;
	}

	.status {
		margin: 0;
		opacity: 0.85;
		font-size: 0.9rem;
	}

	.preview-note {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.85;
	}

	.error {
		color: #ff8a8a;
		margin: 0;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 250;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.7);
	}

	.modal-card {
		display: grid;
		gap: 0.75rem;
		width: min(92vw, 460px);
		padding: 1rem;
		border-radius: 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: color-mix(in srgb, var(--phone-bg) 85%, black 15%);
	}

	.modal-card h3,
	.modal-card p {
		margin: 0;
	}

	.modal-actions {
		display: grid;
		gap: 0.5rem;
	}

	@media (max-width: 760px) {
		.camera-stream {
			grid-template-columns: minmax(0, 44vw) minmax(0, 1fr);
		}
	}

</style>
