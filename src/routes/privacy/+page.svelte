<script>
	import imgLan from '$lib/assets/privacy/lan-only.webp';
	import imgHandshake from '$lib/assets/privacy/handshake.webp';
	import imgStreaming from '$lib/assets/privacy/streaming.webp';
</script>

<svelte:head>
	<title>PeerLens Privacy</title>
</svelte:head>

<div class="page">
	<div class="card">
    <section class="privacy-hero mb-7">
      <div class="grid gap-6">
        <p class="eyebrow">Privacy</p>
        <h1>Your stream stays yours.</h1>
        <p class="lede">
          PeerLens does not collect personal data, does not record your camera feed, and does not watch your
          stream.
        </p>
      </div>
  
      <div class="privacy-visual" aria-hidden="true">
        <img src="{imgLan}" alt="Illustration of a home with local Wi-Fi coverage" />
      </div>
    </section>

    <div class="promise-grid2" aria-label="Privacy promises">
      <div class="subtle-card">
				<div class="icon-chip">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12Z" />
							<path d="M9 12.5C7.61929 12.5 6.5 11.3807 6.5 10C6.5 8.61929 7.61929 7.5 9 7.5C10.3807 7.5 11.5 8.61929 11.5 10C11.5 11.3807 10.3807 12.5 9 12.5ZM9 12.5C11.2091 12.5 13 14.2909 13 16.5M9 12.5C6.79086 12.5 5 14.2909 5 16.5" />
							<path d="M15 9H19" />
							<path d="M15 12H19" />
							<line x1="3" y1="3" x2="21" y2="21" stroke="#a32121" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" />
							<line x1="3" y1="21" x2="21" y2="3" stroke="#a32121" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" />
					</svg>
				</div>
        <div>
          <h3>No account, no tracking</h3>
          <p>No sign-up and no analytics profile tied to you.</p>
        </div>
      </div>
      <div class="subtle-card">
				<div class="icon-chip">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17.4776 9.01106C17.485 9.01102 17.4925 9.01101 17.5 9.01101C19.9853 9.01101 22 11.0294 22 13.5193C22 15.8398 20.25 17.7508 18 18M17.4776 9.01106C17.4924 8.84606 17.5 8.67896 17.5 8.51009C17.5 5.46695 15.0376 3 12 3C9.12324 3 6.76233 5.21267 6.52042 8.03192M17.4776 9.01106C17.3753 10.1476 16.9286 11.1846 16.2428 12.0165M6.52042 8.03192C3.98398 8.27373 2 10.4139 2 13.0183C2 15.4417 3.71776 17.4632 6 17.9273M6.52042 8.03192C6.67826 8.01687 6.83823 8.00917 7 8.00917C8.12582 8.00917 9.16474 8.38194 10.0005 9.01101" />
							<path d="M12 13L12 21M12 13C11.2998 13 9.99153 14.9943 9.5 15.5M12 13C12.7002 13 14.0085 14.9943 14.5 15.5" />
							<line x1="3" y1="3" x2="21" y2="21" stroke="#a32121" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" />
							<line x1="3" y1="21" x2="21" y2="3" stroke="#a32121" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" />
					</svg>
				</div>
        <div>
          <h3>No cloud video storage</h3>
          <p>Your camera feed is not uploaded and not stored by this website.</p>
        </div>
      </div>
      <div class="subtle-card">
				<div class="icon-chip">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
							<path d="M2 8C2 8 6.47715 3 12 3C17.5228 3 22 8 22 8" />
							<path d="M21.544 13.045C21.848 13.4713 22 13.6845 22 14C22 14.3155 21.848 14.5287 21.544 14.955C20.1779 16.8706 16.6892 21 12 21C7.31078 21 3.8221 16.8706 2.45604 14.955C2.15201 14.5287 2 14.3155 2 14C2 13.6845 2.15201 13.4713 2.45604 13.045C3.8221 11.1294 7.31078 7 12 7C16.6892 7 20.1779 11.1294 21.544 13.045Z" />
							<path d="M15 14C15 12.3431 13.6569 11 12 11C10.3431 11 9 12.3431 9 14C9 15.6569 10.3431 17 12 17C13.6569 17 15 15.6569 15 14Z" />
							<line x1="3" y1="3" x2="21" y2="21" stroke="#a32121" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" />
							<line x1="3" y1="21" x2="21" y2="3" stroke="#a32121" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.7" />
					</svg>
				</div>
        <div>
          <h3>No one at PeerLens can see your stream</h3>
          <p>We provide connection setup only, not remote stream monitoring.</p>
        </div>
      </div>
			<div class="subtle-card">
				<div class="icon-chip">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
						<path d="M22 16L20 14H10.5322C9.7959 12.5183 8.26687 11.5 6.5 11.5C4.01471 11.5 2 13.5147 2 16C2 18.4852 4.01471 20.5 6.5 20.5C8.26685 20.5 9.79587 19.4817 10.5322 18H16.5L17.75 16.7073L19 18H20L22 16Z" />
						<path d="M6 16H7" />
						<path d="M3 3.5V8.5" />
						<path d="M6 7V5C6 4.17157 6.67157 3.5 7.5 3.5C8.32843 3.5 9 4.17157 9 5V7C9 7.82843 8.32843 8.5 7.5 8.5C6.67157 8.5 6 7.82843 6 7Z" />
						<path d="M12 3.5V8.5" />
						<path d="M15 3.5V8.5" />
						<path d="M18 7V5C18 4.17157 18.6716 3.5 19.5 3.5C20.3284 3.5 21 4.17157 21 5V7C21 7.82843 20.3284 8.5 19.5 8.5C18.6716 8.5 18 7.82843 18 7Z" />
					</svg>
				</div>
        <div>
          <h3>End-to-end encryption</h3>
          <p>Your video stream is encrypted from your phone to the viewer.</p>
        </div>
      </div>
    </div>
  </div>

	<section class="card">
		<h2 class="section-title">How it works in simple words</h2>

    <div class="privacy-hero mb-4">
      <div class="self-center">
        <p>
          The PeerLens homepage simply creates a session that is used to negotiate a direct <a class="link" href="https://en.wikipedia.org/wiki/WebRTC" target="_blank" rel="noopener noreferrer">WebRTC connection</a> between your phone and viewer.
        </p>
        <p>
          A handshake, if you will.
        </p>
      </div>
      <div class="subtle-card">
        <img src="{imgHandshake}" alt="Illustration of two hands shaking, representing the direct connection between phone and viewer" aria-hidden="true" />
      </div>
    </div>

    <div class="privacy-hero">
      <div class="self-center">
        <p>
          Once the session is established, your phone can stream video directly to the viewer without going through our PeerLens server.
        </p>
      </div>
      <div class="subtle-card p-0">
        <img src="{imgStreaming}" alt="Illustration of streaming from phone to viewer" aria-hidden="true" />
      </div>
    </div>

		<p>
			More nerdy details? Check our <a class="link" href="/data">data section</a> to understand what information is exchanged during session setup and how we handle it.
		</p>
	</section>

	<section class="card safety-card" aria-labelledby="network-trust-title">
		<h2 class="section-title">Important: use networks you trust</h2>
    <div class="flex">
			<div class="pr-4">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" color="currentColor" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
					<path d="M8 9.47776C9.14883 8.54314 10.5209 8 11.9946 8C13.4729 8 14.849 8.54657 16 9.48661M14.1743 12C13.5182 11.5909 12.7779 11.3607 11.9946 11.3607C11.2152 11.3607 10.4784 11.5886 9.82477 11.9938" />
					<path d="M12 15H12.0064" />
					<path d="M21 11.1833V8.28029C21 6.64029 21 5.82028 20.5959 5.28529C20.1918 4.75029 19.2781 4.49056 17.4507 3.9711C16.2022 3.6162 15.1016 3.18863 14.2223 2.79829C13.0234 2.2661 12.424 2 12 2C11.576 2 10.9766 2.2661 9.77771 2.79829C8.89839 3.18863 7.79784 3.61619 6.54933 3.9711C4.72193 4.49056 3.80822 4.75029 3.40411 5.28529C3 5.82028 3 6.64029 3 8.28029V11.1833C3 16.8085 8.06277 20.1835 10.594 21.5194C11.2011 21.8398 11.5046 22 12 22C12.4954 22 12.7989 21.8398 13.406 21.5194C15.9372 20.1835 21 16.8085 21 11.1833Z" />
				</svg>
			</div>
			<div>
				<p>
					PeerLens is designed for local private networks. Anyone with access to that same network could try to
					join a session if they get the session link or QR code.
				</p>
				<p>
					Use PeerLens only on networks you control or trust (for example your own home or company network), and
					avoid sharing session links publicly.
				</p>
			</div>
		</div>
	</section>

	<section class="card repo-card">
    <div>
      <h2 class="section-title">Open source transparency</h2>
      <p>
        You can inspect the public source code and verify how the connection and privacy behavior is implemented.
      </p>
      <a class="btn" href="https://github.com/Boohja/peerlens" target="_blank" rel="noopener noreferrer">
        View repository on GitHub
      </a>
    </div>
	</section>
</div>

<style>

	.privacy-hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(240px, 1fr);
		gap: 1.3rem;
		overflow: hidden;
	}

	.privacy-visual {
		display: grid;
		place-items: center;
	}

	.privacy-visual img {
		width: min(100%, 24rem);
		height: auto;
		filter: drop-shadow(0 1rem 1.8rem rgba(3, 76, 83, 0.2));
	}

	.safety-card {
		display: grid;
		gap: 0.6rem;
		border-color: color-mix(in srgb, #7a1010 45%, var(--primary) 55%);
		background: color-mix(in srgb, #7a1010 12%, rgba(3, 76, 83, 0.4) 88%);
	}

	@media (max-width: 760px) {
		.privacy-hero {
			grid-template-columns: 1fr;
		}
		.safety-card {
			grid-template-columns: 1fr;
		}
	}
</style>
