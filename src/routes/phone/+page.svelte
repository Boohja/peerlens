<script lang="ts">
	import { onMount, tick } from 'svelte';
	import QrReader from '$lib/phone/QrReader.svelte';
	import CameraStream from '$lib/phone/CameraStream.svelte';
	import { ClientSession } from '$lib/client-session';
	import { toast } from '$lib/toast';

	type State =
		| { kind: 'idle' }
		| { kind: 'processing' }
		| { kind: 'scanning' }
		| { kind: 'streaming'; sessionId: string };

	const querySessionId =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search).get('session') ?? ''
			: '';
	const session = new ClientSession('phone');

	let phoneState: State = $state(querySessionId ? { kind: 'processing' } : { kind: 'idle' });
	let lastScanContent = '';
	let scanClearTimer: ReturnType<typeof setTimeout> | undefined;

	async function startPhoneSession(
		sessionId: string,
		onFailureMessage?: string,
		failureState: State = { kind: 'idle' }
	) {
		if (!sessionId) {
			phoneState = failureState;
			return;
		}

		phoneState = { kind: 'processing' };
		session.setSessionId(sessionId);
		session.log(`startPhoneSession: ${sessionId}`);

		try {
			session.log('GET session for validation');
			const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);

			if (!response.ok) {
				session.log(`session validation failed: HTTP ${response.status}`);
				session.clear(sessionId);
				phoneState = failureState;
				if (onFailureMessage && response.status !== 429) {
					toast('error', onFailureMessage);
				}
				return;
			}

			const payload = (await response.json()) as { viewerState: string | null };
			if (payload.viewerState === 'left') {
				session.log('session validation failed: viewer left');
				session.clear(sessionId);
				phoneState = failureState;
				if (onFailureMessage) {
					toast('error', onFailureMessage);
				}
				return;
			}

			session.log(
				`session validation passed; viewer_state=${payload.viewerState ?? 'null'}; start streaming`
			);
			phoneState = { kind: 'streaming', sessionId };
		} catch {
			session.log('session validation failed: network/error');
			phoneState = failureState;
		}
	}

	function resetScanClearTimer() {
		clearTimeout(scanClearTimer);
		scanClearTimer = setTimeout(() => {
			lastScanContent = '';
		}, 4000);
	}

	async function onScan(scanned: string) {
		resetScanClearTimer();
		if (scanned === lastScanContent) {
			return;
		}
		let scanError = '';
		lastScanContent = scanned;

		try {
			const url = new URL(scanned);
			const sessionId = url.searchParams.get('session');

			if (sessionId) {
				session.log(`QR scan produced session: ${sessionId}`);
				await startPhoneSession(sessionId, 'Session expired or unavailable. Keep scanning.', {
					kind: 'scanning'
				});
			} else {
				scanError = 'Not a valid PerLens Code - keep scanning.';
			}
		} catch {
			scanError = 'Not a PerLens Code - keep scanning.';
		}
		if (scanError) {
			toast('error', scanError);
		}
	}

	function onScanError(_message: string) {
		phoneState = { kind: 'idle' };
	}

	async function startScanning() {
		if (phoneState.kind === 'scanning') {
			phoneState = { kind: 'idle' };
			await tick();
		}
		phoneState = { kind: 'scanning' };
	}

	async function onStreamCancel() {
		session.clear();
		await startScanning();
	}

	onMount(async () => {
		session.clear();

		if (phoneState.kind !== 'processing') return;

		if (querySessionId) {
			session.log(`session from URL: ${querySessionId}`);

			// Strip ?session from URL without reloading
			const url = new URL(window.location.href);
			url.searchParams.delete('session');
			history.replaceState({}, '', url.toString());
			session.log('removed ?session from URL via history.replaceState');

			await startPhoneSession(querySessionId, 'Session expired or unavailable. Please scan again.');
			return;
		}

		phoneState = { kind: 'idle' };
	});

</script>

<svelte:head>
	<title>PeerLens Phone</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="content">
	{#if phoneState.kind === 'idle'}
		<section>
			<div class="card hero">
				<div class="phone-copy">
					<h1>Use your phone as the camera.</h1>
					<p class="lede">
						Open this page on a device with a camera, while the <a class="link" href="/viewer">viewer page</a> is open on a different device.
					</p>

					<div aria-label="Phone flow overview">
						<div class="subtle-card">
							<div class="icon-chip icon-phone" aria-hidden="true">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M12.6974 3.5H11.303C10.5884 3.5 10.2311 3.5 9.91067 3.612C9.71499 3.68039 9.53113 3.77879 9.36568 3.90367C9.09474 4.10816 8.89655 4.40544 8.50018 5L8.50017 5.00001C8.29717 5.30453 7.99794 5.75337 7.87867 5.87871C7.58314 6.18927 7.19563 6.39666 6.77329 6.47029C6.60284 6.5 6.41985 6.5 6.05387 6.5C5.07379 6.5 4.58376 6.5 4.18307 6.61342C3.18074 6.89716 2.39734 7.68055 2.1136 8.68289C2.00018 9.08357 2.00018 9.57361 2.00018 10.5537V14.5C2.00018 17.3284 2.00018 18.7426 2.87886 19.6213C3.75754 20.5 5.17176 20.5 8.00018 20.5H16.0002C18.8286 20.5 20.2428 20.5 21.1215 19.6213C22.0002 18.7426 22.0002 17.3284 22.0002 14.5V10.5537C22.0002 9.57361 22.0002 9.08357 21.8868 8.68289C21.603 7.68055 20.8196 6.89716 19.8173 6.61342C19.4166 6.5 18.9266 6.5 17.9465 6.5C17.5805 6.5 17.3975 6.5 17.2271 6.47029C16.8047 6.39666 16.4172 6.18927 16.1217 5.87871C16.0024 5.75336 15.7032 5.30451 15.5002 5C15.1038 4.40544 14.9056 4.10816 14.6347 3.90367C14.4692 3.77879 14.2854 3.68039 14.0897 3.612C13.7693 3.5 13.412 3.5 12.6974 3.5Z" />
									<path d="M16.0002 13C16.0002 15.2091 14.2093 17 12.0002 17C9.79104 17 8.00018 15.2091 8.00018 13C8.00018 10.7909 9.79104 9 12.0002 9C14.2093 9 16.0002 10.7909 16.0002 13Z" />
									<path d="M19.0002 9.5V9.51" />
								</svg>
							</div>
							<div>
								<h3>Start scanning</h3>
								Tap the button below and allow camera access if prompted.
							</div>
						</div>
						<div class="subtle-card">
							<div class="icon-chip icon-phone" aria-hidden="true">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M3 6C3 4.58579 3 3.87868 3.43934 3.43934C3.87868 3 4.58579 3 6 3C7.41421 3 8.12132 3 8.56066 3.43934C9 3.87868 9 4.58579 9 6C9 7.41421 9 8.12132 8.56066 8.56066C8.12132 9 7.41421 9 6 9C4.58579 9 3.87868 9 3.43934 8.56066C3 8.12132 3 7.41421 3 6Z" />
									<path d="M3 18C3 16.5858 3 15.8787 3.43934 15.4393C3.87868 15 4.58579 15 6 15C7.41421 15 8.12132 15 8.56066 15.4393C9 15.8787 9 16.5858 9 18C9 19.4142 9 20.1213 8.56066 20.5607C8.12132 21 7.41421 21 6 21C4.58579 21 3.87868 21 3.43934 20.5607C3 20.1213 3 19.4142 3 18Z" />
									<path d="M3 12L9 12" />
									<path d="M12 3V8" />
									<path d="M15 6C15 4.58579 15 3.87868 15.4393 3.43934C15.8787 3 16.5858 3 18 3C19.4142 3 20.1213 3 20.5607 3.43934C21 3.87868 21 4.58579 21 6C21 7.41421 21 8.12132 20.5607 8.56066C20.1213 9 19.4142 9 18 9C16.5858 9 15.8787 9 15.4393 8.56066C15 8.12132 15 7.41421 15 6Z" />
									<path d="M21 12H15C13.5858 12 12.8787 12 12.4393 12.4393C12 12.8787 12 13.5858 12 15M12 17.7692V20.5385M15 15V16.5C15 17.9464 15.7837 18 17 18C17.5523 18 18 18.4477 18 19M16 21H15M18 15C19.4142 15 20.1213 15 20.5607 15.44C21 15.8799 21 16.5881 21 18.0043C21 19.4206 21 20.1287 20.5607 20.5687C20.24 20.8898 19.7767 20.9766 19 21" />
								</svg>
							</div>
							<div>
								<h3>Scan the QR code</h3>
								<p>Point the camera at the code shown on the viewer screen.</p>
							</div>
						</div>
						<div class="subtle-card">
							<div class="icon-chip icon-phone" aria-hidden="true">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M17 21C18.8692 21 19.8038 21 20.5 20.5981C20.9561 20.3348 21.3348 19.9561 21.5981 19.5C22 18.8038 22 17.8692 22 16C22 14.1308 22 13.1962 21.5981 12.5C21.3348 12.0439 20.9561 11.6652 20.5 11.4019C19.8038 11 18.8692 11 17 11H7C5.13077 11 4.19615 11 3.5 11.4019C3.04394 11.6652 2.66523 12.0439 2.40192 12.5C2 13.1962 2 14.1308 2 16C2 17.8692 2 18.8038 2.40192 19.5C2.66523 19.9561 3.04394 20.3348 3.5 20.5981C4.19615 21 5.13077 21 7 21H17Z" />
									<path d="M16 6C15.0227 4.77354 13.5929 4 12 4C10.4071 4 8.97726 4.77354 8 6" />
									<path d="M14 8C13.5114 7.38677 12.7965 7 12 7C11.2035 7 10.4886 7.38677 10 8" />
									<path d="M5 14V18H6.5M19 18H17V16M17 16V14H19M17 16H18.5M9 14V18M11.5 14L13 18L14.5 14" />
								</svg>
							</div>
							<div>
								<h3>Stream to viewer</h3>
								<p>Once connected, your camera feed is sent to the paired viewer device.</p>
							</div>
						</div>
					</div>

					<button onclick={startScanning} class="btn btn-phone justify-self-start">Scan Code</button>
				</div>

				<div class="phone-visual" aria-hidden="true">
					<div class="glow glow-large"></div>
					<div class="glow glow-small"></div>
					<div class="device-stack">
						<div class="device back"></div>
						<div class="device front">
							<div class="lens"></div>
							<div class="scan-lines"></div>
						</div>
					</div>
				</div>
			</div>
		</section>

	{:else if phoneState.kind === 'processing'}
		<div class="card state-card">
			<p>Processing...</p>
		</div>
	{:else if phoneState.kind === 'scanning'}
		<div class="card state-card">
			<p>Point your camera at the QR code on the viewer screen.</p>

			<QrReader {onScan} onError={onScanError} />

		</div>
		<button onclick={() => (phoneState = { kind: 'idle' })} class="btn btn-phone">Cancel</button>
	{:else if phoneState.kind === 'streaming'}
		<CameraStream sessionId={phoneState.sessionId} onCancel={onStreamCancel} />
	{/if}
</div>

<style>
	.phone-copy {
		display: grid;
		gap: 1rem;
	}

	.phone-visual {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 100%;
	}

	.device-stack {
		position: relative;
		width: 12rem;
		height: 16rem;
	}

	.device {
		position: absolute;
		border-radius: 1.3rem;
		border: 1px solid rgba(255, 255, 255, 0.38);
		box-shadow: 0 1.1rem 2.2rem rgba(3, 76, 83, 0.24);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--phone-bg) 22%, white 78%),
			color-mix(in srgb, var(--phone-bg) 70%, white 30%)
		);
	}

	.device.back {
		inset: 1.4rem 1.2rem 0.4rem 0.5rem;
		transform: rotate(-12deg);
		opacity: 0.68;
	}

	.device.front {
		inset: 0.3rem 1.1rem 1.3rem 0.8rem;
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.lens {
		width: 4.6rem;
		height: 4.6rem;
		border-radius: 999px;
		background:
			radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0) 42%),
			radial-gradient(circle, color-mix(in srgb, var(--phone-bg) 28%, #4f2a22 72%), #4f2a22);
		box-shadow: inset 0 0 0 0.35rem rgba(255, 255, 255, 0.24);
	}

	.scan-lines {
		position: absolute;
		left: 1.2rem;
		right: 1.2rem;
		top: 2rem;
		bottom: 2rem;
		border-radius: 1rem;
		background:
			linear-gradient(
				to bottom,
				transparent 0 15%,
				rgba(255, 255, 255, 0.45) 15% 17%,
				transparent 17% 32%,
				rgba(255, 255, 255, 0.36) 32% 34%,
				transparent 34% 100%
			);
		opacity: 0.64;
	}

	.glow {
		position: absolute;
		border-radius: 999px;
		pointer-events: none;
	}

	.glow-large {
		width: 10rem;
		height: 10rem;
		top: 0.7rem;
		right: 0.6rem;
		background: color-mix(in srgb, var(--phone-bg) 34%, white 66%);
		opacity: 0.45;
	}

	.glow-small {
		width: 4.3rem;
		height: 4.3rem;
		left: 1rem;
		bottom: 1rem;
		background: color-mix(in srgb, var(--phone-bg) 52%, white 48%);
		opacity: 0.55;
	}

	.state-card {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 0.75rem;
	}

	@media (max-width: 760px) {
		.phone-visual {
			order: -1;
			min-height: 11rem;
		}

		.device-stack {
			width: 9.5rem;
			height: 12.5rem;
		}
	}
</style>
