<script lang="ts">
	export let durationMs = 4000;
	export let animationKey: string | number = 0;
	export let size = '1.35rem';
	export let complete = false;
</script>

{#key animationKey}
	<svg
		viewBox="0 0 20 20"
		aria-hidden="true"
		focusable="false"
		class="countdown-ring"
		style={`--countdown-duration: ${durationMs}ms; width: ${size}; height: ${size};`}
	>
		<circle class="timer-track" cx="10" cy="10" r="8" />
		<circle class:timer-complete={complete} class="timer-progress" cx="10" cy="10" r="8" />
	</svg>
{/key}

<style>
	.countdown-ring {
		display: block;
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
		animation: countdown var(--countdown-duration) linear forwards;
	}

	.timer-complete {
		animation: none;
		stroke-dashoffset: 50.265;
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