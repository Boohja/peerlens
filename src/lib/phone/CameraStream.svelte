<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { ClientSession } from '$lib/client-session';
	import CountdownRing from '$lib/CountdownRing.svelte';
	import { PhoneRtcManager } from '$lib/phone/PhoneRtcManager';

	const dispatch = createEventDispatcher<{ cancel: void }>();
	let { sessionId = '' }: { sessionId: string } = $props();

	let videoEl: HTMLVideoElement;
	let stream: MediaStream | null = null;
	let error = $state('');
	let started = $state(false);
	let signalingStatus = $state('Idle');
	let loadingCameras = $state(false);
	let cameras = $state<MediaDeviceInfo[]>([]);
	let selectedCameraId = $state('');
	let showIpv6FallbackModal = $state(false);

	let idleOverlay = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let idleTimerVisualKey = $state(0);
	const IDLE_TIMEOUT_MS = 10_000;
	const session = new ClientSession('phone');
	const rtcManager = new PhoneRtcManager({
		session,
		getSessionId: () => sessionId,
		onStatusChange: (nextStatus) => {
			signalingStatus = nextStatus;
		},
		onErrorChange: (nextError) => {
			error = nextError;
		},
		onShowIpv6FallbackChange: (show) => {
			showIpv6FallbackModal = show;
		},
		onConnected: () => {
			resetIdleTimer();
		},
		onPeerDisconnected: () => {
			stopCamera();
			dispatch('cancel');
		}
	});

	$effect(() => {
		if (sessionId) {
			session.setSessionId(sessionId);
		}
	});

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
		idleTimerVisualKey += 1;
		void syncPreviewPlayback();
		idleTimer = setTimeout(() => {
			idleOverlay = true;
			void syncPreviewPlayback();
		}, IDLE_TIMEOUT_MS);
	}

	function triggerIdleMode() {
		if (!started) return;
		clearIdleTimer();
		idleOverlay = true;
		void syncPreviewPlayback();
	}

	function clearIdleTimer() {
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	}

	function onWindowInteraction() {
		if (!started || idleOverlay) return;
		resetIdleTimer();
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

	function openImplicationsPage() {
		window.open('/ipv6', '_blank', 'noopener,noreferrer');
	}

	function stopForRejectedIpv6Fallback() {
		rtcManager.rejectIpv6FallbackCandidate();
		stopCamera();
	}

	function confirmIpv6FallbackCandidate() {
		rtcManager.confirmIpv6FallbackCandidate();
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

	async function startCamera() {
		error = '';
		signalingStatus = 'Starting camera...';
		stopCamera();

		try {
			stream = await navigator.mediaDevices.getUserMedia(streamConstraints());
			session.log('camera started');

			videoEl.srcObject = stream;
			await videoEl.play();
			started = true;

			const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? '';
			await loadCameras(activeId);

			if (sessionId) {
				await rtcManager.start(stream);
			} else {
				signalingStatus = 'Missing session';
				session.log('missing session id while starting signaling');
			}
		} catch (err) {
			console.error(err);
			session.log(`startCamera failed: ${String(err)}`);

			if (err instanceof Error && err.message === 'Session expired or missing') {
				session.clear(sessionId);
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

			await rtcManager.replaceVideoTrack(nextTrack, nextStream);

			stream = nextStream;
			videoEl.srcObject = nextStream;
			await videoEl.play();

			if (previousStream) {
				for (const track of previousStream.getTracks()) track.stop();
			}

			const activeId = nextTrack.getSettings().deviceId ?? '';
			await loadCameras(activeId);

			signalingStatus =
				rtcManager.getConnectionState() === 'connected' ? 'Connected' : 'Connecting...';
		} catch (err) {
			console.error(err);
			setCameraError(err);
			signalingStatus =
				rtcManager.getConnectionState() === 'connected' ? 'Connected' : 'Not connected';
		}
	}

	function stopCamera() {
		rtcManager.stop();
		clearIdleTimer();
		signalingStatus = 'Stopped';
		if (stream) {
			for (const track of stream.getTracks()) track.stop();
			stream = null;
		}
		if (videoEl) videoEl.srcObject = null;
		started = false;
	}

	async function onCameraChange(event: Event) {
		resetIdleTimer();
		selectedCameraId = (event.currentTarget as HTMLSelectElement).value;
		if (started) await switchCamera();
	}

	onMount(() => {
		const onDeviceChange = () => {
			if (started || cameras.length > 0) void loadCameras();
		};

		const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel'];
		for (const eventName of interactionEvents) {
			window.addEventListener(eventName, onWindowInteraction, { passive: true });
		}

		// When the phone comes back from background and the camera track was killed
		// by the OS, do a full camera restart.
		const onVisibilityChange = () => {
			if (document.hidden || !started) return;
			const videoTrack = stream?.getVideoTracks()[0];
			if (videoTrack && videoTrack.readyState === 'ended') {
				void startCamera();
			}
		};

		navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
		document.addEventListener('visibilitychange', onVisibilityChange);
		void startCamera();

		return () => {
			for (const eventName of interactionEvents) {
				window.removeEventListener(eventName, onWindowInteraction);
			}
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
		onpointerdown={wakeFromIdle}
		onpointerup={(event) => {
			event.preventDefault();
			event.stopPropagation();
		}}
		onclick={wakeFromIdleClick}
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
					onchange={onCameraChange}
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
			<button
				type="button"
				class="btn btn-phone idle-mode-button"
				onclick={triggerIdleMode}
				disabled={!started || idleOverlay}
			>
				<CountdownRing
					durationMs={IDLE_TIMEOUT_MS}
					animationKey={idleTimerVisualKey}
					size="1.1rem"
					complete={idleOverlay}
				/>
				<span>{idleOverlay ? 'Energy saving active' : 'Energy saving mode'}</span>
			</button>

			<button
				class="btn btn-phone"
				onclick={() => {
					if (sessionId) {
						void session.setState('left', sessionId);
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
				<button class="btn btn-phone block" type="button" onclick={openImplicationsPage}>
					<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 16V11.5" />
						<path d="M12 8.01172V8.00172" />
					</svg>
					See implications
				</button>
				<button class="btn btn-phone" type="button" onclick={confirmIpv6FallbackCandidate}>
					<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<path d="M17 3.33782C15.5291 2.48697 13.8214 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 11.3151 21.9311 10.6462 21.8 10" />
						<path d="M8 12.5C8 12.5 9.5 12.5 11.5 16C11.5 16 17.0588 6.83333 22 5" />
					</svg>
					Confirm IPv6
				</button>
				<button class="btn btn-phone" type="button" onclick={stopForRejectedIpv6Fallback}>
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

	.idle-mode-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
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
