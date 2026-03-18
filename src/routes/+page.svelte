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
    <div class="grid grid-cols-2 gap-4 mt-14">
      <a href="/viewer" class="btn btn-viewer text-center">Viewer</a>
      <a href="/phone" class="btn btn-phone text-center">Phone</a>
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


  @media (max-width: 760px) {
    .step {
      grid-template-columns: 1fr;
    }
    .step-2 div {
      order: 2;
    }
  }
</style>
