<script lang="ts">
	type VideoFit = 'contain' | 'cover';

	type Props = {
		remoteStream?: MediaStream | null;
		status?: string;
		fullscreen?: boolean;
		videoFit?: VideoFit;
		onFitChange?: (fit: VideoFit) => void;
		onFullscreenChange?: (fullscreen: boolean) => void;
		onRetry?: () => void;
	};

	let {
		remoteStream = null,
		status = '',
		fullscreen = false,
		videoFit = 'contain',
		onFitChange,
		onFullscreenChange,
		onRetry
	}: Props = $props();

	let remoteVideoEl: HTMLVideoElement | undefined;

	$effect(() => {
		const videoElement = remoteVideoEl;

		if (videoElement && remoteStream && videoElement.srcObject !== remoteStream) {
			videoElement.srcObject = remoteStream;
			void videoElement.play().catch(() => undefined);
		} else if (videoElement && !remoteStream && videoElement.srcObject) {
			videoElement.srcObject = null;
		}
	});
</script>

<div class="video-wrap" class:fullscreen>
	<div class="video-controls">
		<button
			type="button"
			class:active={videoFit === 'cover'}
			onclick={() => {
				onFitChange?.('cover');
				onFullscreenChange?.(true);
			}}
			title="Fill width - crops top and bottom"
		>
			<svg viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<rect x="0" y="0" width="20" height="12" rx="1" fill="currentColor" opacity="0.25"></rect>
				<rect x="5" y="0" width="10" height="12" rx="1" fill="currentColor"></rect>
				<line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 2" opacity="0.6"></line>
				<line x1="0" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="0.75" stroke-dasharray="2 2" opacity="0.6"></line>
			</svg>
			Fill width
		</button>
		<button
			type="button"
			class:active={videoFit === 'contain'}
			onclick={() => {
				onFitChange?.('contain');
				onFullscreenChange?.(true);
			}}
			title="Fit height - black bars on sides"
		>
			<svg viewBox="0 0 20 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<rect x="0" y="0" width="20" height="12" rx="1" fill="currentColor" opacity="0.25"></rect>
				<rect x="7" y="0" width="6" height="12" rx="1" fill="currentColor"></rect>
			</svg>
			Fit height
		</button>
		{#if fullscreen}
			<button
				type="button"
				class="close-btn"
				onclick={() => onFullscreenChange?.(false)}
				title="Exit fullscreen"
			>
				X
			</button>
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
		<button class="btn btn-viewer retry-btn" type="button" onclick={() => onRetry?.()}>
			Retry
		</button>
	{/if}
</div>

<style>
	.status {
		color: #d8ffd8;
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

	.retry-btn,
		.video-wrap.fullscreen .retry-btn {
		position: absolute;
		bottom: 3.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
	}
</style>