<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { dismissToast, toasts } from '$lib/toast';
</script>

{#if $toasts.length > 0}
	<div class="toast-region" aria-live="polite" aria-atomic="true">
		<div class="toast-stack">
			{#each $toasts as toast (toast.id)}
				<article
					class={`toast toast--${toast.variant}`}
					in:fly={{ y: 14, duration: 150 }}
					out:fade={{ duration: 130 }}
					animate:flip={{ duration: 170 }}
				>
					<p class="toast-text">{toast.text}</p>
					<button
						type="button"
						class="toast-timer"
						style={`--toast-duration: ${toast.durationMs}ms;`}
						onclick={() => dismissToast(toast.id)}
						aria-label="Dismiss notification"
					>
						<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
							<circle class="timer-track" cx="10" cy="10" r="8" />
							<circle class="timer-progress" cx="10" cy="10" r="8" />
						</svg>
					</button>
				</article>
			{/each}
		</div>
	</div>
{/if}

<style>
	.toast-region {
		position: fixed;
		bottom: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(760px, calc(100vw - 1rem));
		z-index: 1000;
		pointer-events: none;
	}

	.toast-stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.toast {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.65rem 0.8rem;
		border-radius: 0.5rem;
		border: 1px solid;
		pointer-events: auto;
	}

	.toast--success {
		background: var(--viewer-bg-soft);
		border-color: var(--viewer-bg);
		color: var(--primary);
	}

	.toast--warning {
		background: var(--phone-bg-soft);
		border-color: var(--phone-bg);
		color: var(--primary);
	}

	.toast--error {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}

	.toast-text {
		margin: 0;
		flex: 1;
	}

	.toast-timer {
		appearance: none;
		display: inline-grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
		opacity: 0.85;
		transition: opacity 140ms ease;
	}

	.toast-timer:hover {
		opacity: 1;
	}

	.toast-timer svg {
		width: 100%;
		height: 100%;
	}

	.timer-track,
	.timer-progress {
		fill: none;
		stroke-width: 2;
	}

	.timer-track {
		stroke: currentColor;
		opacity: 0.22;
	}

	.timer-progress {
		stroke: currentColor;
		stroke-linecap: round;
		transform: rotate(-90deg);
		transform-origin: 10px 10px;
		stroke-dasharray: 50.265;
		stroke-dashoffset: 0;
		animation: countdown var(--toast-duration) linear forwards;
	}

	@keyframes countdown {
		from {
			stroke-dashoffset: 0;
		}

		to {
			stroke-dashoffset: 50.265;
		}
	}
</style>
