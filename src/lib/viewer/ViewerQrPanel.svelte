<script lang="ts">
	type Props = {
		phoneJoinUrl?: string;
		status?: string;
		blurCode?: boolean;
		onRenew?: () => void;
		onCancel?: () => void;
	};

	let {
		phoneJoinUrl = '',
		status = '',
		blurCode = false,
		onRenew,
		onCancel
	}: Props = $props();

	let qrCodeUrl = $state('');
	let qrModulePromise: Promise<typeof import('qrcode')> | null = null;
	let qrRequestId = 0;

	async function toQrDataUrl(value: string) {
		qrModulePromise ??= import('qrcode');
		const { toDataURL } = await qrModulePromise;

		return toDataURL(value, {
			width: 320,
			margin: 1,
			errorCorrectionLevel: 'M'
		});
	}

	async function updateQrCode(url: string) {
		const requestId = ++qrRequestId;

		if (!url) {
			qrCodeUrl = '';
			return;
		}

		qrCodeUrl = '';

		try {
			const value = await toQrDataUrl(url);
			if (requestId === qrRequestId && url === phoneJoinUrl) {
				qrCodeUrl = value;
			}
		} catch (err) {
			console.error(err);
			if (requestId === qrRequestId) {
				qrCodeUrl = '';
			}
		}
	}

	$effect(() => {
		void updateQrCode(phoneJoinUrl);
	});
</script>

<div class="card qr-panel">
	<h1>Scan with your phone</h1>
	<p class="intro">
		Open the phone page on your smartphone, scan this code, and keep this viewer tab open.
	</p>

	<div class:blur={blurCode} class="qr-wrap">
		{#if qrCodeUrl}
			<img src={qrCodeUrl} alt="QR code for phone join URL" class="qr-image" />
			<a class="join-link" href={phoneJoinUrl} target="_blank" rel="noopener noreferrer">
				{phoneJoinUrl}
			</a>
		{:else}
			<div class="qr-placeholder">
				<div class="pulse"></div>
				<p>{status || 'Preparing session...'}</p>
			</div>
		{/if}
	</div>

	<p class="status-line"><strong>Status:</strong> {status || 'Preparing session...'}</p>

	<div class="grid grid-cols-2 gap-6">
		<button class="btn btn-viewer" type="button" onclick={() => onRenew?.()}>
			<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3.05493 13C3.01863 12.6717 3 12.338 3 12C3 7.02944 7.02944 3 12 3C14.8273 3 17.35 4.30367 19 6.34267M20.9451 11C20.9814 11.3283 21 11.662 21 12C21 16.9706 16.9706 21 12 21C9.17273 21 6.64996 19.6963 5 17.6573" />
				<path d="M16 7H17C18.4142 7 19.1213 7 19.5607 6.56066C20 6.12132 20 5.41421 20 4V3" />
				<path d="M8 17H7C5.58579 17 4.87868 17 4.43934 17.4393C4 17.8787 4 18.5858 4 20V21" />
			</svg>
			New session
		</button>
	
		<button class="btn btn-viewer btn-subtle" type="button" onclick={() => onCancel?.()}>
			<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 21.5H12H12C16.4783 21.5 18.7175 21.5 20.1088 20.1088C21.5 18.7175 21.5 16.4783 21.5 12V12V12C21.5 7.52165 21.5 5.28248 20.1088 3.89124C18.7175 2.5 16.4783 2.5 12 2.5C7.52166 2.5 5.28249 2.5 3.89124 3.89124C2.5 5.28249 2.5 7.52166 2.5 12C2.5 16.4783 2.5 18.7175 3.89124 20.1088C5.28248 21.5 7.52165 21.5 12 21.5Z" />
				<path d="M15 9L9 14.9996M15 15L9 9.00039" />
			</svg>
			Cancel
		</button>
	</div>
</div>

<style>
	.qr-panel {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 0.85rem;
	}

	h1,
		.intro,
		.status-line,
		.qr-placeholder p {
		margin: 0;
	}

	.intro {
		max-width: 34ch;
		line-height: 1.55;
		opacity: 0.9;
	}

	.qr-wrap {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		width: 100%;
	}

	.qr-image,
		.qr-placeholder {
		width: min(320px, 100%);
		min-height: 320px;
		border-radius: 1rem;
		background: white;
		padding: 0.85rem;
		box-shadow: 0 1rem 2.5rem rgba(3, 76, 83, 0.2);
	}

	.qr-image {
		height: auto;
	}

	.qr-placeholder {
		display: grid;
		place-items: center;
		gap: 1rem;
		color: #1d1d1d;
	}

	.pulse {
		width: 4rem;
		height: 4rem;
		border-radius: 999px;
		background: radial-gradient(circle, rgba(39, 104, 163, 0.8), rgba(39, 104, 163, 0.12));
		animation: pulse 1.4s ease-in-out infinite;
	}

	.join-link {
		font-size: 0.8rem;
		opacity: 0.65;
		word-break: break-all;
	}

	.status-line {
		word-break: break-word;
	}

	.blur {
		filter: blur(8px);
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(0.92);
			opacity: 0.65;
		}

		50% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>