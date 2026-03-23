<script>
  import imgStep1 from '$lib/assets/landing/step1.webp';
  import imgStep2 from '$lib/assets/landing/step2.webp';
</script>

<svelte:head>
	<title>PeerLens</title>
</svelte:head>

<div class="page">
  <div class="card">
    <p class="eyebrow">PeerLens</p>
    <p class="lead">
      A WebRTC-based viewer for streaming your phone camera to the browser.<br>No installs, no account, no data collected.<br>Everything <a href="/privacy" class="link">local and private</a>.
    </p>

    <div class="step step-1">
      <img src="{imgStep1}" alt="Illustration of the viewer and phone pairing process" aria-hidden="true" />
      <div>Scan a QR Code to pair your phone with the Browser...</div>
    </div>

    <div class="step step-2">
      <div>
        And watch your camera feed in real time, right in the browser.
      </div>
      <img src="{imgStep2}" alt="Illustration of the viewer and phone pairing process" aria-hidden="true" />
    </div>

    <h2 class="text-center text-3xl mt-12">What role do you pick?</h2>
    <div class="grid grid-cols-2 gap-4 mt-14">
      <a href="/viewer" class="btn btn-viewer text-center">
        <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 21H16M14 21C13.1716 21 12.5 20.3284 12.5 19.5V17L12 17M14 21H10M10 21H8M10 21C10.8284 21 11.5 20.3284 11.5 19.5V17L12 17M12 17V21" />
          <path d="M16 3H8C5.17157 3 3.75736 3 2.87868 3.87868C2 4.75736 2 6.17157 2 9V11C2 13.8284 2 15.2426 2.87868 16.1213C3.75736 17 5.17157 17 8 17H16C18.8284 17 20.2426 17 21.1213 16.1213C22 15.2426 22 13.8284 22 11V9C22 6.17157 22 4.75736 21.1213 3.87868C20.2426 3 18.8284 3 16 3Z" />
          <path d="M14.576 9.235L11.189 7.11812C11.0655 7.04093 10.9228 7 10.7771 7C10.3479 7 10 7.34793 10 7.77712V12.2229C10 12.6521 10.3479 13 10.7771 13C10.9228 13 11.0655 12.9591 11.189 12.8819L14.576 10.765C14.8398 10.6001 15 10.311 15 10C15 9.68896 14.8398 9.39985 14.576 9.235Z" />
        </svg>
        Viewer
      </a>
      <a href="/phone" class="btn btn-phone text-center">
        <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.5 21.5L8.5 17.5M10.5 17.5L14.5 21.5M9.5 17.5L9.5 22.5" />
          <path d="M2 11.875C2 9.81261 2 8.78141 3.02513 8.1407C4.05025 7.5 5.70017 7.5 9 7.5H10C13.2998 7.5 14.9497 7.5 15.9749 8.1407C17 8.78141 17 9.81261 17 11.875V13.125C17 15.1874 17 16.2186 15.9749 16.8593C14.9497 17.5 13.2998 17.5 10 17.5H9C5.70017 17.5 4.05025 17.5 3.02513 16.8593C2 16.2186 2 15.1874 2 13.125V11.875Z" />
          <path d="M17 10.2495L17.1259 10.174C19.2417 8.90435 20.2996 8.26954 21.1498 8.57605C22 8.88257 22 9.89876 22 11.9312V13.0685C22 15.1009 22 16.1171 21.1498 16.4236C20.2996 16.7301 19.2417 16.0953 17.1259 14.8257L17 14.7501" />
          <circle cx="12.5" cy="5" r="2.5" />
          <circle cx="7" cy="4.5" r="3" />
        </svg>
        Phone
      </a>
    </div>
  </div>
</div>

<style>
  .lead {
    font-size: 1.15rem;
    line-height: 1.7;
    opacity: 0.9; 
    text-align: center; 
  }

  .step {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.4rem;
  }
  .step div {
    display: grid;
    align-items: center;
    font-size: 1.15rem;
    line-height: 1.4;
  }

  .eyebrow {
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    opacity: 0.82;
    color: var(--primary);
    text-align: center;
  }

  .btn .icon {
    width: 2.5rem;
    height: 2.5rem;
    display: block;
    margin: 0 auto 0.5rem;
  }

  @media (max-width: 760px) {
    .step {
      grid-template-columns: 1fr;
    }
    .step-2 div {
      order: 2;
    }
  }
</style>
