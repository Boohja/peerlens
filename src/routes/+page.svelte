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
			<p class="eyebrow">PeerLens</p>
			<h1 id="landing-title">Use your phone camera on your desktop browser.</h1>
			<p class="lead">
				Pair with a QR code, stream over WebRTC, and keep the session local. No account, no install,
				no collected data. Everything <a href="/privacy">local and private</a>.
			</p>
			<div class="hero-actions" aria-label="Choose your PeerLens role">
				<a href="/viewer" class="role-cta role-cta-viewer">
					<span class="role-kicker">Desktop</span>
					<span class="role-name">Start as viewer</span>
				</a>
				<a href="/phone" class="role-cta role-cta-phone">
					<span class="role-kicker">Phone</span>
					<span class="role-name">Open camera</span>
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
			<span>WebRTC connects both devices directly whenever your network allows it.</span>
		</div>
		<div>
			<strong>Fast to try</strong>
			<span>Open viewer on desktop, scan with phone, and the feed appears in the browser.</span>
		</div>
		<div>
			<strong>Nothing to manage</strong>
			<span>Temporary sessions, no accounts, and clear local data notes.</span>
		</div>
	</section>

	<section class="flow-card" aria-labelledby="flow-title">
		<div>
			<p class="section-label">How it works</p>
			<h2 id="flow-title">Two screens, one short handshake.</h2>
		</div>

		<div class="flow-steps">
			<div class="flow-step">
				<span class="step-number viewer-step">1</span>
				<h3>Start the viewer</h3>
				<p>Create a temporary browser session on the desktop where you want to see the camera feed.</p>
			</div>
			<div class="flow-step">
				<span class="step-number phone-step">2</span>
				<h3>Scan with the phone</h3>
				<p>The phone joins by QR code and asks for camera access only when you choose that role.</p>
			</div>
			<div class="flow-step">
				<span class="step-number mixed-step">3</span>
				<h3>Watch live</h3>
				<p>The phone becomes the lens, and the desktop becomes the larger view for whatever you need to inspect.</p>
			</div>
		</div>
	</section>
</div>

<style>
	.landing-page {
		width: 100%;
		color: #082f34;
	}

	.landing-shell {
		position: relative;
		display: grid;
		gap: clamp(1.2rem, 3vw, 1.8rem);
		padding: clamp(1.15rem, 3.6vw, 2.4rem);
		border: 1px solid rgba(3, 76, 83, 0.34);
		border-radius: 18px;
		background:
			linear-gradient(140deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.2)),
			rgba(3, 76, 83, 0.2);
		box-shadow: 0 24px 70px rgba(3, 76, 83, 0.2);
		backdrop-filter: blur(12px) saturate(120%);
		-webkit-backdrop-filter: blur(12px) saturate(120%);
		overflow: hidden;
	}

	.landing-shell::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 18% 18%, rgba(139, 192, 245, 0.35), transparent 32%),
			radial-gradient(circle at 84% 78%, rgba(216, 145, 133, 0.38), transparent 34%);
		pointer-events: none;
	}

	.hero-copy,
	.hero-stage {
		position: relative;
		z-index: 1;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		color: var(--primary);
	}

	h1 {
		max-width: 11.8ch;
		margin: 0;
		font-size: clamp(3rem, 9vw, 5.35rem);
		line-height: 0.95;
		letter-spacing: -0.055em;
		color: #063f46;
	}

	.lead {
		max-width: 34rem;
		margin: 1.15rem 0 0;
		font-size: clamp(1.02rem, 1.7vw, 1.18rem);
		line-height: 1.55;
		color: rgba(8, 47, 52, 0.86);
	}

	.lead a {
		color: var(--primary);
		font-weight: 800;
		text-decoration: underline;
		text-decoration-thickness: 0.09em;
		text-underline-offset: 0.18em;
	}

	.hero-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
		margin-top: 1.6rem;
	}

	.role-cta {
		display: grid;
		gap: 0.12rem;
		min-height: 4.25rem;
		padding: 0.78rem 1rem;
		border-radius: 999px;
		text-decoration: none;
		border: 1px solid rgba(3, 76, 83, 0.28);
		box-shadow: 0 12px 28px rgba(3, 76, 83, 0.12);
		transition:
			transform 180ms ease,
			box-shadow 180ms ease,
			filter 180ms ease;
	}

	.role-cta:hover {
		transform: translateY(-2px);
		box-shadow: 0 18px 34px rgba(3, 76, 83, 0.16);
		filter: saturate(1.04);
	}

	.role-cta:active {
		transform: translateY(0);
	}

	.role-kicker {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.72;
	}

	.role-name {
		font-size: clamp(1rem, 1.8vw, 1.18rem);
		font-weight: 800;
	}

	.role-cta-viewer {
		background: linear-gradient(135deg, rgba(139, 192, 245, 0.98), rgba(196, 224, 252, 0.86));
		color: #173f69;
	}

	.role-cta-phone {
		background: linear-gradient(135deg, rgba(216, 145, 133, 0.98), rgba(253, 209, 201, 0.82));
		color: #623126;
	}

	.hero-stage {
		display: grid;
		align-content: center;
		gap: 0.9rem;
		min-height: auto;
		padding: 0.4rem 0;
	}

	.stage-panel {
		position: relative;
		border-radius: 18px;
		border: 1px solid rgba(255, 255, 255, 0.42);
		background: rgba(255, 255, 255, 0.3);
		box-shadow: 0 18px 42px rgba(3, 76, 83, 0.18);
		overflow: hidden;
	}

	.stage-panel img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.stage-panel-pair {
		width: min(92%, 34rem);
		aspect-ratio: 844 / 432;
		justify-self: start;
		transform: rotate(-1.4deg);
	}

	.stage-panel-stream {
		width: min(92%, 34rem);
		aspect-ratio: 844 / 432;
		justify-self: end;
		transform: rotate(1.4deg);
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
		background: rgba(255, 255, 255, 0.68);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(8, 47, 52, 0.82);
	}

	.proof-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin: clamp(1.25rem, 2.6vw, 1.8rem) 0;
	}

	.proof-strip div,
	.flow-card {
		border: 1px solid rgba(3, 76, 83, 0.25);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.38);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.proof-strip div {
		padding: 0.9rem 1rem;
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
		grid-template-columns: minmax(0, 0.74fr) minmax(0, 1.26fr);
		gap: 1.25rem;
		margin-bottom: 2rem;
		padding: clamp(1rem, 2.8vw, 1.55rem);
	}

	.section-label {
		margin: 0 0 0.45rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(3, 76, 83, 0.7);
	}

	h2 {
		margin: 0;
		max-width: 11ch;
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1;
		letter-spacing: -0.045em;
		color: #063f46;
	}

	.flow-steps {
		display: grid;
		gap: 0.7rem;
	}

	.flow-step {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.85rem;
		align-items: start;
		padding: 0.85rem;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.36);
		border: 1px solid rgba(255, 255, 255, 0.34);
	}

	.step-number {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		border-radius: 999px;
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
			width: 100%;
		}

		.landing-shell {
			border-radius: 16px;
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
			font-size: clamp(2.55rem, 18vw, 3.5rem);
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
