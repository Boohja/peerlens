<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import CountdownRing from '$lib/CountdownRing.svelte';
	import { dismissToast, toasts } from '$lib/toast';
</script>

{#if $toasts.length > 0}
	<div class="toast-region" aria-live="polite" aria-atomic="true">
		<div class="toast-stack">
			{#each $toasts as toast (toast.id)}
				<article
					class={`toast toast--${toast.variant}`}
					in:fly|global={{ x: 36, duration: 180, opacity: 0.35 }}
					out:fade|global={{ duration: 130 }}
					animate:flip={{ duration: 170 }}
				>
					<p class="toast-text">{toast.text}</p>
					<button
						type="button"
						class="toast-timer"
						onclick={() => dismissToast(toast.id)}
						aria-label="Dismiss notification"
					>
						<CountdownRing durationMs={toast.durationMs} />
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
		box-shadow: 1px 1px 6px 1px #000000;
		backdrop-filter: blur(8.9px);
		-webkit-backdrop-filter: blur(6.9px);
	}

	.toast--success {
		background: rgba(69, 122, 69, 0.342);
		border-color: rgba(69, 122, 69, 0.342);
		color: #013d01;
	}

	.toast--warning {
		background: rgb(207 198 67 / 58%);
		border-color: rgb(207 198 67 / 58%);
		color: rgb(57 57 3);
	}

	.toast--error {
		background: rgba(255, 0, 0, 0.48);
		border: 1px solid rgba(255, 0, 0, 0.33);
		color: rgb(77, 1, 1);
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

</style>
