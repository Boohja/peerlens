<script lang="ts">
	import { onMount, tick } from 'svelte';
	import QrReader from '$lib/phone/QrReader.svelte';
	import CameraStream from '$lib/phone/CameraStream.svelte';
	import {
		appendSessionIdentityLog,
		clearSessionIdentity,
		getSessionIdentity,
		setSessionIdentity
	} from '$lib/session-identity';

	type State =
		| { kind: 'idle' }
		| { kind: 'processing'; sessionId: string }
		| { kind: 'scanning' }
		| { kind: 'streaming'; sessionId: string };

	const querySessionId =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search).get('session') ?? ''
			: '';
	const storedIdentity = getSessionIdentity();
	const initialSessionId = querySessionId || storedIdentity?.sessionId || '';

	let phoneState: State = $state(
		initialSessionId ? { kind: 'processing', sessionId: initialSessionId } : { kind: 'idle' }
	);
	let scanError = $state('');

	async function onScan(event: CustomEvent<string>) {
		const scanned = event.detail;
		scanError = '';

		try {
			const url = new URL(scanned);
			const sessionId = url.searchParams.get('session');

			if (sessionId) {
				appendSessionIdentityLog(`QR scan produced session: ${sessionId}`);
				phoneState = { kind: 'streaming', sessionId };
			} else {
				scanError = 'Not a valid PerLens Code - keep scanning.';
			}
		} catch {
			scanError = 'Not a PerLens Code - keep scanning.';
		}
	}

	function onScanError(event: CustomEvent<string>) {
		scanError = event.detail;
		phoneState = { kind: 'idle' };
	}

	async function startScanning() {
		scanError = '';
		if (phoneState.kind === 'scanning') {
			phoneState = { kind: 'idle' };
			await tick();
		}
		phoneState = { kind: 'scanning' };
	}

	async function onStreamCancel() {
		clearSessionIdentity();
		await startScanning();
	}

	onMount(async () => {
		if (phoneState.kind !== 'processing') return;

		const { sessionId } = phoneState;

		if (querySessionId) {
			// Store in localStorage, replacing any outdated entry
			setSessionIdentity(sessionId);
			appendSessionIdentityLog(`session from URL: ${sessionId}`);

			// Strip ?session from URL without reloading
			const url = new URL(window.location.href);
			url.searchParams.delete('session');
			history.replaceState({}, '', url.toString());
			appendSessionIdentityLog('removed ?session from URL via history.replaceState');
		}

		// Always validate the session against the server
		try {
			appendSessionIdentityLog('GET session for validation');
			const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);

			if (!response.ok) {
				// Session not found or server error — discard stale identity
				appendSessionIdentityLog(`session validation failed: HTTP ${response.status}`);
				clearSessionIdentity();
				phoneState = { kind: 'idle' };
				return;
			}

			const session = (await response.json()) as { viewerState: string | null };

			if (session.viewerState === 'left') {
				appendSessionIdentityLog('session validation: viewer_state is left; clearing local identity');
				clearSessionIdentity();
				phoneState = { kind: 'idle' };
				return;
			}

			// offered → viewer is ready to answer; waiting → viewer expects an offer
			appendSessionIdentityLog(
				`session validation passed; viewer_state=${session.viewerState ?? 'null'}; start streaming`
			);
			phoneState = { kind: 'streaming', sessionId };
		} catch {
			appendSessionIdentityLog('session validation failed: network/error');
			clearSessionIdentity();
			phoneState = { kind: 'idle' };
		}
	});

	$effect(() => {
		if (phoneState.kind === 'streaming') {
			setSessionIdentity(phoneState.sessionId);
			return;
		}

		if (phoneState.kind === 'idle') {
			clearSessionIdentity();
		}
	});

</script>

<svelte:head>
	<title>PeerLens</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="content">
	{#if phoneState.kind === 'idle'}

    <div class="card">
      <p>Use this page on your smartphone while having the <a href="/viewer">viewer page</a> open on your desktop or any other device.</p>
      <ol class="list-decimal list-inside">
        <li>Hit the "Scan Code" button.</li>
        <li>Allow camera access if prompted.</li>
        <li>Point your camera at the QR code on the viewer page.</li>
        <li>Wait for the connection to establish.</li>
      </ol>
    </div>

		{#if scanError}
			<p class="error">{scanError}</p>
		{/if}

		<button onclick={startScanning} class="btn btn-phone">Scan Code</button>
	{:else if phoneState.kind === 'processing'}
		<div class="card">
			<p>Processing...</p>
		</div>
	{:else if phoneState.kind === 'scanning'}
    <div class="card">
      {#if scanError}
        <p class="error">{scanError}</p>
      {:else}
        <p>Point your camera at the QR code on the viewer PC.</p>
      {/if}

		<QrReader on:scan={onScan} on:error={onScanError} />

    </div>  
		<button onclick={() => (phoneState = { kind: 'idle' })} class="btn btn-phone">Cancel</button>
	{:else if phoneState.kind === 'streaming'}
		<CameraStream sessionId={phoneState.sessionId} on:cancel={onStreamCancel} />
	{/if}
</div>
