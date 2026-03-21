<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { ClientSession, tryRecoverSession } from '$lib/client-session';
	import { toast } from '$lib/toast';
	import { buildPhoneJoinUrl } from '$lib/webrtc/config';
	import { createApiError } from '$lib/webrtc/signaling-client';
	import { ViewerRtcManager } from '$lib/viewer/ViewerRtcManager';
	import ViewerLanding from '$lib/viewer/ViewerLanding.svelte';
	import ViewerQrPanel from '$lib/viewer/ViewerQrPanel.svelte';
	import ViewerStream from '$lib/viewer/ViewerStream.svelte';

	type ViewerStep = 'landing' | 'qr' | 'stream';

	let sessionId = $state('');
	let phoneJoinUrl = $state('');
	let status = $state('');
	let previousStatus = $state('');
	let blurCode = $state(false);
	let step = $state<ViewerStep>('landing');
	let videoFit = $state<'contain' | 'cover'>('contain');
	let fullscreen = $state(false);
	let remoteStream = $state<MediaStream | null>(null);
	const session = new ClientSession('viewer');
	const rtcManager = new ViewerRtcManager({
		session,
		getSessionId: () => sessionId,
		onStatusChange: (nextStatus) => {
			status = nextStatus;
		},
		onStepChange: (nextStep) => {
			step = nextStep;
		},
		onBlurCodeChange: (blur) => {
			blurCode = blur;
		},
		onRemoteStreamChange: (stream) => {
			remoteStream = stream;
		},
		onSessionInvalidated: () => {
			sessionId = '';
		}
	});

	$effect(() => {
		if (status === 'Disconnected' && previousStatus !== 'Disconnected') {
			toast('error', 'Camera disconnected');
		}

		previousStatus = status;
	});

	$effect(() => {
		if (step !== 'stream') fullscreen = false;
	});

	function getErrorMessage(error: unknown, fallbackMessage: string): string {
		if (error instanceof Error && error.message.trim()) {
			return error.message.trim();
		}

		return fallbackMessage;
	}

	function handleRefreshSessionError(error: unknown) {
		const message = getErrorMessage(error, 'Could not create a new session');
		session.log(`refreshSession failed: ${message}`);
		status = message;
		toast('error', message);
	}

	function handleRecoverSessionError(error: unknown) {
		const message = getErrorMessage(error, 'Could not recover the previous session');
		session.log(`recoverSession failed: ${message}`);
		status = message;
		step = 'landing';
		toast('error', message);
	}

	async function createSession(): Promise<string> {
		session.log('POST /api/sessions');
		const response = await fetch('/api/sessions', { method: 'POST' });
		if (!response.ok) {
			throw await createApiError(response, 'Could not create signaling session');
		}

		const payload = (await response.json()) as { sessionId: string };
		if (!payload.sessionId) {
			throw new Error('Invalid signaling session response');
		}

		session.log(`session created: ${payload.sessionId}`);

		return payload.sessionId;
	}

	async function refreshSession() {
		const previousSessionId = sessionId;
		step = 'qr';
		fullscreen = false;
		rtcManager.stop();
		if (previousSessionId) {
			await session.destroy(previousSessionId);
		}

		status = 'Creating session...';
		sessionId = await createSession();
		session.setSessionId(sessionId);
		session.log(`set local session identity: ${sessionId}`);
		const origin = window.location.origin;
		phoneJoinUrl = buildPhoneJoinUrl(sessionId, origin);
		blurCode = false;

		await rtcManager.start(sessionId);
	}

	onMount(async () => {
		session.log('tryRecoverSession');
		const recovery = await tryRecoverSession();
		if (!recovery.ok) {
			if (recovery.reason === 'not-found') {
				session.log('session recovery failed: session not found');
			} else if (recovery.reason === 'viewer-left') {
				session.log('session recovery failed: viewer left');
			} else if (recovery.reason === 'request-failed') {
				session.log(
					`session recovery failed: request failed${recovery.status ? ` (HTTP ${recovery.status})` : ''}`
				);
			}
			return;
		}

		try {
			sessionId = recovery.session.sessionId;
			session.log(
				`session recovery passed; viewer_state=${recovery.session.viewerState ?? 'null'}; restore viewer`
			);
			const origin = window.location.origin;
			phoneJoinUrl = buildPhoneJoinUrl(sessionId, origin);
			blurCode = false;
			step = 'qr';
			status = 'Restoring session...';

			await rtcManager.start(sessionId);
		} catch (error) {
			handleRecoverSessionError(error);
		}
	});

	onDestroy(() => {
		const currentSessionId = sessionId;
		rtcManager.stop();
		void session.destroy(currentSessionId);
	});
</script>

<svelte:head>
	<title>PeerLens Viewer</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && fullscreen) fullscreen = false; }} />

<main class="content">
	{#if step === 'landing'}
		<ViewerLanding onStart={() => void refreshSession().catch(handleRefreshSessionError)} />
	{:else if step === 'qr'}
		<ViewerQrPanel
			{phoneJoinUrl}
			{status}
			{blurCode}
			onRenew={() => void refreshSession().catch(handleRefreshSessionError)}
			onCancel={async () => {
				rtcManager.stop();
				await session.destroy(sessionId);
				sessionId = '';
				phoneJoinUrl = '';
				status = '';
				blurCode = false;
				step = 'landing';
			}}
		/>
	{:else if step === 'stream'}
		<ViewerStream
			{remoteStream}
			{status}
			{fullscreen}
			{videoFit}
			onFitChange={(nextFit) => {
				videoFit = nextFit;
			}}
			onFullscreenChange={(nextFullscreen) => {
				fullscreen = nextFullscreen;
			}}
			onRetry={() => void refreshSession().catch(handleRefreshSessionError)}
		/>
	{/if}

</main>