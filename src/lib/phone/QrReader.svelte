<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type QrScanner from 'qr-scanner';

	const dispatch = createEventDispatcher<{ scan: string; error: string }>();

	let videoEl: HTMLVideoElement;
	let scannerInstance: QrScanner | null = null;

	// Cooldown prevents the same QR from firing repeated events while the parent processes
	let lastDispatchAt = 0;
	const DISPATCH_COOLDOWN_MS = 1500;

	onMount(async () => {
		const { default: QrScannerLib } = await import('qr-scanner');

		try {
			scannerInstance = new QrScannerLib(
				videoEl,
				(result) => {
					const now = Date.now();
					if (now - lastDispatchAt < DISPATCH_COOLDOWN_MS) return;
					lastDispatchAt = now;
					dispatch('scan', result.data);
				},
				{
					preferredCamera: 'environment',
					highlightScanRegion: true,
					highlightCodeOutline: true,
					maxScansPerSecond: 5
				}
			);

			await scannerInstance.start();
		} catch (err) {
			console.error(err);
			const message =
				err instanceof DOMException && err.name === 'NotAllowedError'
					? 'Camera permission was denied.'
					: 'Could not access camera: ' + err;
			dispatch('error', message);
		}
	});

	onDestroy(() => {
		scannerInstance?.stop();
		scannerInstance?.destroy();
		scannerInstance = null;
	});
</script>

<!-- qr-scanner manages the video element internals; we just provide the target -->
<div class="qr-reader">
	<video bind:this={videoEl} muted playsinline class="qr-video"></video>
</div>

<style>
	.qr-reader {
		display: grid;
	}

	.qr-video {
		width: 100%;
		aspect-ratio: 1;
		background: #000;
		border-radius: 5px;
    border: 1px solid var(--primary);
		object-fit: cover;
	}
</style>
