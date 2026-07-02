<script>
	import imgStep1 from '$lib/assets/landing/step1.webp';
	import imgStep2 from '$lib/assets/landing/step2.webp';
</script>

<svelte:head>
	<title>PeerLens</title>
</svelte:head>

<div class="page landing-page">
	<section class="landing-shell" aria-labelledby="landing-title">
		<div class="hero-copy">
			<h1 id="landing-title">Use your phone camera in another browser.</h1>
			<p class="lead">
				Start a temporary viewer, scan the QR code with the camera phone, and watch the feed where
				you need it. No account, no install, no analytics.
			</p>

			<div class="privacy-line" aria-label="Privacy summary">
				<span
					>The camera feed goes directly between your devices.<br>Everything 
					<a href="/privacy">local and private</a>.</span
				>
			</div>

			<div class="hero-actions" aria-label="Choose your PeerLens role">
				<a href="/viewer" class="role-cta role-cta-viewer">
					<span class="role-kicker">Viewing screen</span>
					<span class="role-name">Start as viewer</span>
					<span class="role-detail">Create the QR session.</span>
				</a>
				<a href="/phone" class="role-cta role-cta-phone">
					<span class="role-kicker">Camera phone</span>
					<span class="role-name">Open camera</span>
					<span class="role-detail">Join an existing viewer.</span>
				</a>
			</div>
		</div>

		<div class="hero-stage" aria-label="PeerLens pairing preview">
			<div class="stage-panel stage-panel-pair">
				<img src={imgStep1} alt="Desktop browser showing a QR code next to a paired phone." />
				<span class="stage-label">Scan once</span>
			</div>
			<div class="stage-panel stage-panel-stream">
				<img src={imgStep2} alt="Phone camera streaming live video to a desktop browser." />
				<span class="stage-label">Stream locally</span>
			</div>
		</div>
	</section>

	<section class="proof-strip" aria-label="PeerLens privacy promises">
		<div>
			<strong>Private by design</strong>
			<span
				>Temporary signaling helps the devices find each other; the camera feed is not stored.</span
			>
		</div>
		<div>
			<strong>Fast to try</strong>
			<span>Open a viewer, scan with the phone, and the feed appears in the browser.</span>
		</div>
		<div>
			<strong>Nothing to manage</strong>
			<span>Temporary sessions, no accounts, and clear local data notes.</span>
		</div>
	</section>

	<section class="flow-card" aria-labelledby="flow-title">
		<div>
			<h2 id="flow-title">Two screens, one short handshake.</h2>
		</div>

		<div class="flow-steps">
			<div class="flow-step">
				<span class="step-number viewer-step">1</span>
				<h3>Start the viewer</h3>
				<p>
					Create a temporary browser session on the desktop where you want to see the camera feed.
				</p>
			</div>
			<div class="flow-step">
				<span class="step-number phone-step">2</span>
				<h3>Scan with the phone</h3>
				<p>The phone joins by QR code and asks for camera access only when you choose that role.</p>
			</div>
			<div class="flow-step">
				<span class="step-number mixed-step">3</span>
				<h3>Watch live</h3>
				<p>
					The phone becomes the lens, and the desktop becomes the larger view for whatever you need
					to inspect.
				</p>
			</div>
		</div>
	</section>
</div>

<style>
	.landing-page {
		width: min(1120px, calc(100vw - 2rem));
		margin-left: 50%;
		transform: translateX(-50%);
		color: #082f34;
	}

	.landing-shell {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr);
		align-items: center;
		gap: clamp(1.5rem, 4vw, 3.5rem);
		padding: clamp(1.25rem, 3.2vw, 3rem);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.42);
		border: 1px solid rgba(3, 76, 83, 0.24);
	}

	.hero-copy,
	.hero-stage {
		position: relative;
		z-index: 1;
	}

	h1 {
		max-width: 14ch;
		margin: 0;
		font-size: clamp(2.85rem, 5.8vw, 4.6rem);
		line-height: 1;
		letter-spacing: -0.028em;
		color: #063f46;
		text-wrap: balance;
	}

	.lead {
		max-width: 38rem;
		margin: 1.25rem 0 0;
		font-size: clamp(1.02rem, 1.7vw, 1.18rem);
		line-height: 1.55;
		color: rgba(8, 47, 52, 0.86);
	}

	.privacy-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.8rem;
		align-items: center;
		max-width: 38rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(3, 76, 83, 0.22);
		font-size: 0.96rem;
		line-height: 1.45;
		color: rgba(8, 47, 52, 0.8);
	}

	.privacy-line a {
		color: var(--primary);
		font-weight: 800;
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.hero-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 1.45rem;
	}

	.role-cta {
		display: grid;
		gap: 0.18rem;
		min-height: 6.2rem;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		text-decoration: none;
		border: 1px solid currentColor;
		transition:
			transform 180ms ease,
			background-color 180ms ease,
			filter 180ms ease;
	}

	.role-cta:hover {
		transform: translateY(-2px);
		filter: saturate(1.04);
	}

	.role-cta:active {
		transform: translateY(0);
	}

	.role-kicker {
		font-size: 0.78rem;
		font-weight: 700;
		opacity: 0.72;
	}

	.role-name {
		font-size: clamp(1rem, 1.8vw, 1.18rem);
		font-weight: 800;
	}

	.role-detail {
		font-size: 0.88rem;
		line-height: 1.35;
		opacity: 0.78;
	}

	.role-cta-viewer {
		background: rgba(232, 244, 255, 0.78);
		color: #173f69;
	}

	.role-cta-phone {
		background: rgba(255, 231, 226, 0.72);
		color: #623126;
	}

	.hero-stage {
		display: grid;
		align-content: center;
		gap: 0.85rem;
		min-height: auto;
		padding: 0;
	}

	.stage-panel {
		position: relative;
		border-radius: 12px;
		border: 1px solid rgba(3, 76, 83, 0.28);
		background: rgba(255, 255, 255, 0.5);
		overflow: hidden;
	}

	.stage-panel img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.stage-panel-pair {
		width: min(94%, 34rem);
		aspect-ratio: 844 / 432;
		justify-self: start;
	}

	.stage-panel-stream {
		width: min(94%, 34rem);
		aspect-ratio: 844 / 432;
		justify-self: end;
	}

	.stage-label {
		position: absolute;
		left: 0.9rem;
		bottom: 0.75rem;
		display: inline-flex;
		align-items: center;
		min-height: 1.55rem;
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.82);
		font-size: 0.78rem;
		font-weight: 800;
		color: rgba(8, 47, 52, 0.82);
	}

	.proof-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		margin: clamp(1.5rem, 3.2vw, 2.25rem) 0;
		border: 1px solid rgba(3, 76, 83, 0.24);
		border-radius: 12px;
		overflow: hidden;
	}

	.proof-strip div {
		padding: 1rem;
		background: rgba(255, 255, 255, 0.44);
	}

	.proof-strip strong,
	.proof-strip span {
		display: block;
	}

	.proof-strip strong {
		margin-bottom: 0.35rem;
		color: #063f46;
	}

	.proof-strip span {
		font-size: 0.94rem;
		line-height: 1.45;
		color: rgba(8, 47, 52, 0.78);
	}

	.flow-card {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(1.2rem, 3vw, 2rem);
		margin-bottom: 2rem;
		padding: clamp(1rem, 3vw, 1.75rem) 0;
		border-top: 1px solid rgba(3, 76, 83, 0.28);
	}

	h2 {
		margin: 0;
		max-width: 12ch;
		font-size: clamp(2rem, 4vw, 3.15rem);
		line-height: 1.02;
		letter-spacing: -0.03em;
		color: #063f46;
		text-wrap: balance;
	}

	.flow-steps {
		display: grid;
		gap: 0;
		border-top: 1px solid rgba(3, 76, 83, 0.24);
	}

	.flow-step {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.9rem;
		align-items: start;
		padding: 0.9rem 0;
		border-bottom: 1px solid rgba(3, 76, 83, 0.24);
	}

	.step-number {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		border-radius: 0.5rem;
		font-weight: 900;
	}

	.viewer-step {
		background: var(--viewer-bg);
		color: #173f69;
	}

	.phone-step {
		background: var(--phone-bg);
		color: #623126;
	}

	.mixed-step {
		background: linear-gradient(135deg, var(--viewer-bg), var(--phone-bg));
		color: #083238;
	}

	.flow-step h3 {
		margin: 0;
		font-size: 1.05rem;
		color: #063f46;
	}

	.flow-step p {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.45;
		color: rgba(8, 47, 52, 0.78);
	}

	@media (prefers-reduced-motion: reduce) {
		.role-cta {
			transition: none;
		}

		.role-cta:hover,
		.role-cta:active {
			transform: none;
		}
	}

	@media (max-width: 900px) {
		.landing-shell {
			grid-template-columns: 1fr;
		}

		.flow-card {
			grid-template-columns: 1fr;
		}

		h1,
		h2 {
			max-width: 13ch;
		}
	}

	@media (max-width: 760px) {
		.landing-page {
			width: calc(100vw - 1rem);
		}

		.landing-shell {
			border-radius: 10px;
		}

		.hero-actions,
		.proof-strip {
			grid-template-columns: 1fr;
		}

		.hero-stage {
			min-height: auto;
			display: grid;
			gap: 0.8rem;
		}

		.stage-panel {
			position: relative;
			inset: auto;
			width: 100%;
			transform: none;
		}

		.stage-label {
			left: 0.7rem;
			bottom: 0.65rem;
		}
	}

	@media (max-width: 480px) {
		h1 {
			font-size: clamp(2.45rem, 15vw, 3.35rem);
		}

		.landing-shell,
		.flow-card {
			padding: 0.9rem;
		}

		.stage-label {
			left: 0.55rem;
			bottom: 0.5rem;
			min-height: 1.35rem;
			padding: 0.22rem 0.42rem;
			font-size: 0.66rem;
			letter-spacing: 0.06em;
		}
	}
</style>
