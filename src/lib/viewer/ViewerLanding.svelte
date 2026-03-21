<script lang="ts">
	type Props = {
		onStart?: () => void;
	};

	let { onStart }: Props = $props();
</script>

<section class="viewer-landing">
	<div class="card hero">
		<div class="hero-copy">
			<h1>Turn your desktop into the receiving screen.</h1>
			<p class="lede">
				Start here when you want to pair with a phone camera, then watch the live feed on a larger
				screen.
			</p>

			<div>
				<div class="subtle-card">
					<div class="icon-chip icon-viewer" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" />
							<path d="M2.5 9H21.5" />
							<path d="M6.99981 6H7.00879" />
							<path d="M10.9998 6H11.0088" />
						</svg>
					</div>
					<div>
						<h3>Open the viewer</h3>
						<p>Tap the button below to create a new session.</p>
					</div>
				</div>
	
				<div class="subtle-card">
					<div class="icon-chip icon-viewer" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
							<path stroke="#8ca6bd" d="M21 20C20.3567 18.7133 19 17.0243 19 15.5279C19 13.8295 19.3671 11.7341 18.5777 10.1554C18.2445 9.48892 18 8.81397 18 8.05573V4.42857C18 4.19188 17.8081 4 17.5714 4C16.1513 4 15 5.15127 15 6.57143M8 18L11.6348 20.2717C11.8755 20.4222 12.0814 20.6222 12.2389 20.8583L13 22" />
							<path d="M5.02734 15C5.08201 16.0967 5.24516 16.7809 5.73203 17.2678C6.46426 18 7.64277 18 9.99979 18C12.3568 18 13.5353 18 14.2676 17.2678C14.9998 16.5355 14.9998 15.357 14.9998 13V7C14.9998 4.64298 14.9998 3.46447 14.2676 2.73223C13.5353 2 12.3568 2 9.99979 2C7.64277 2 6.46426 2 5.73203 2.73223C5.24516 3.2191 5.08201 3.90328 5.02734 5" />
							<path stroke="#8ca6bd" d="M4.25 7.5H5.75C6.44036 7.5 7 6.94036 7 6.25C7 5.55964 6.44036 5 5.75 5L4.25 5C3.55964 5 3 5.55964 3 6.25C3 6.94036 3.55964 7.5 4.25 7.5ZM4.25 7.5L6.75 7.5C7.44036 7.5 8 8.05964 8 8.75C8 9.44036 7.44036 10 6.75 10L4.25 10M4.25 7.5C3.55964 7.5 3 8.05964 3 8.75C3 9.44036 3.55964 10 4.25 10M4.25 10L5.75 10C6.44036 10 7 10.5596 7 11.25C7 11.9404 6.44036 12.5 5.75 12.5H4.25M4.25 10C3.55964 10 3 10.5596 3 11.25C3 11.9404 3.55964 12.5 4.25 12.5M4.25 12.5H5.25C5.94036 12.5 6.5 13.0596 6.5 13.75C6.5 14.4404 5.94036 15 5.25 15H4.25C3.55964 15 3 14.4404 3 13.75C3 13.0596 3.55964 12.5 4.25 12.5Z" />
							<path d="M9.99981 15H10.0088" />
						</svg>
					</div>
					<div>
						<h3>Pair with a phone</h3>
						<p>Scan the QR Code with your phone to establish a connection.</p>
					</div>
				</div>
	
				<div class="subtle-card">
					<div class="icon-chip icon-viewer" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M5.00342 12.001L6.03831 17.0164C6.49989 19.2534 6.73067 20.3719 7.55975 21.0308C9.13581 22.2831 14.8599 22.2871 16.441 21.0308C17.2701 20.3719 17.5009 19.2534 17.9625 17.0164L18.9973 12.001" />
							<path d="M15.0044 12.0148L14.0044 21.999" />
							<path d="M11.0938 2.31253C11.4908 2.4964 11.8312 2.8496 12.0243 3.02872C12.2175 2.8496 12.5092 2.49637 12.9062 2.3125C14.4774 1.58479 16.6099 2.17175 17.4834 3.66401C17.8376 4.26919 18.1149 5.10452 18.0481 5.98859C19.2574 5.98859 20.9317 6.89326 20.9968 8.83838C21.0557 10.5998 20.1509 11.3979 19.4073 11.7759C19.0347 11.9653 18.6108 12.0135 18.1926 12.0135L5.80737 12.0135C5.38915 12.0135 4.96528 11.9653 4.59267 11.7759C3.84906 11.3979 2.94431 10.5998 3.00322 8.83841C3.06828 6.89329 4.79866 6.03205 6.00801 6.03205C5.94113 5.14798 6.16241 4.26922 6.51665 3.66404C7.39012 2.17178 9.52256 1.58482 11.0938 2.31253Z" />
						</svg>
					</div>
					<div>
						<h3>Watch the feed</h3>
						<p>Enjoy your camera footage on the viewer.</p>
					</div>
				</div>
	
				<button type="button" class="btn btn-viewer cta" onclick={() => onStart?.()}>
					Create new session
				</button>
			</div>
		</div>

		<div class="hero-visual" aria-hidden="true">
			<div class="orb orb-large"></div>
			<div class="orb orb-small"></div>
			<div class="mock-stage">
				<div class="screen-frame screen-primary">
					<div class="screen-grid"></div>
					<div class="screen-signal">
						<span></span>
						<span></span>
						<span></span>
					</div>
				</div>
				<div class="screen-frame screen-secondary">
					<div class="screen-camera"></div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.viewer-landing {
		display: grid;
		gap: 1rem;
	}

	.hero::before {
		content: '';
		position: absolute;
		inset: auto -5rem -7rem auto;
		width: 16rem;
		height: 16rem;
		border-radius: 999px;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0));
		pointer-events: none;
	}

	.hero-copy {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	.hero-visual {
		position: relative;
		min-height: 100%;
		display: grid;
		place-items: center;
		padding: 1rem 0;
	}

	.mock-stage {
		position: relative;
		width: min(100%, 22rem);
		height: 20rem;
	}

	.screen-frame {
		position: absolute;
		border-radius: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.4);
		background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(219, 237, 255, 0.55));
		box-shadow: 0 1.2rem 2.6rem rgba(3, 76, 83, 0.24);
		overflow: hidden;
	}

	.screen-primary {
		inset: 1.25rem 1.5rem 3.5rem 0.75rem;
	}

	.screen-secondary {
		width: 7rem;
		height: 12.5rem;
		right: 0.2rem;
		bottom: 0.5rem;
		transform: rotate(10deg);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 209, 205, 0.82));
	}

	.screen-grid {
		position: absolute;
		inset: 1rem;
		border-radius: 1rem;
		background:
			radial-gradient(circle at 20% 20%, rgba(3, 76, 83, 0.16), transparent 35%),
			linear-gradient(135deg, rgba(39, 104, 163, 0.22), rgba(255, 255, 255, 0.35));
	}

	.screen-grid::before,
		.screen-grid::after {
		content: '';
		position: absolute;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.72);
	}

	.screen-grid::before {
		width: 7rem;
		height: 0.85rem;
		top: 1.4rem;
		left: 1.2rem;
	}

	.screen-grid::after {
		width: 4.8rem;
		height: 0.85rem;
		top: 3rem;
		left: 1.2rem;
	}

	.screen-signal {
		position: absolute;
		right: 1.2rem;
		bottom: 1.1rem;
		display: flex;
		gap: 0.45rem;
		align-items: end;
	}

	.screen-signal span {
		display: block;
		width: 0.65rem;
		border-radius: 999px;
		background: #2768a3;
	}

	.screen-signal span:nth-child(1) {
		height: 1rem;
		opacity: 0.45;
	}

	.screen-signal span:nth-child(2) {
		height: 1.8rem;
		opacity: 0.68;
	}

	.screen-signal span:nth-child(3) {
		height: 2.5rem;
	}

	.screen-camera {
		position: absolute;
		inset: 0.9rem;
		border-radius: 1.15rem;
		background:
			radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 40%),
			linear-gradient(155deg, rgba(216, 145, 133, 0.3), rgba(161, 76, 59, 0.78));
	}

	.screen-camera::before {
		content: '';
		position: absolute;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 999px;
		inset: calc(50% - 1.75rem);
		background: radial-gradient(circle, rgba(255, 255, 255, 0.88), rgba(3, 76, 83, 0.78));
	}

	.orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(2px);
		pointer-events: none;
	}

	.orb-large {
		width: 11rem;
		height: 11rem;
		top: 0.4rem;
		right: 1.2rem;
		background: rgba(255, 255, 255, 0.28);
	}

	.orb-small {
		width: 4.5rem;
		height: 4.5rem;
		left: 0.8rem;
		bottom: 1rem;
		background: rgba(255, 255, 255, 0.36);
	}

	@media (max-width: 760px) {
		.hero-visual {
			order: -1;
			min-height: 14rem;
		}

		.mock-stage {
			height: 15rem;
		}

		.screen-primary {
			inset: 1rem 2rem 2.8rem 0.5rem;
		}
	}
</style>