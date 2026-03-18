<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let qrCodeUrl = '';
	export let phoneJoinUrl = '';
	export let status = '';
	export let blurCode = false;

	const dispatch = createEventDispatcher<{ renew: void }>();
</script>

<div class="card qr-panel">
	<p class="eyebrow">Step 2</p>
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

	<button class="btn btn-viewer" type="button" onclick={() => dispatch('renew')}>
		New session
	</button>
</div>

<style>
	.qr-panel {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 0.85rem;
	}

	.eyebrow,
	h1,
		.intro,
		.status-line,
		.qr-placeholder p {
		margin: 0;
	}

	.eyebrow {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.8;
	}

	h1 {
		font-size: clamp(1.7rem, 4vw, 2.5rem);
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