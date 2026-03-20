<script lang="ts">
	import Collapsible from '$lib/Collapsible.svelte';
	import { sessionIdentity } from '$lib/session-identity';

	type SessionInfoResponse = {
		sessionId: string;
		offer: { type: 'offer'; sdp: string } | null;
		answer: { type: 'answer'; sdp: string } | null;
		expiresAt: number | null;
		connectedAt: number | null;
		viewerState: 'offered' | 'waiting' | 'party' | 'left' | null;
		phoneState: 'offered' | 'waiting' | 'party' | 'left' | null;
		stateVersion: number;
		viewerStateAt: number | null;
		phoneStateAt: number | null;
		createdAt: number;
		updatedAt: number;
	};

	let isSessionInfoOpen = $state(false);
	let isSessionInfoLoading = $state(false);
	let sessionInfoError = $state('');
	let sessionInfo = $state<SessionInfoResponse | null>(null);

	function formatUnixTimestamp(value: number | null) {
		if (!value) return '—';
		return new Date(value * 1000).toLocaleString();
	}

	async function openSessionInfoModal() {
		const identity = $sessionIdentity;
		if (!identity?.sessionId) return;

		isSessionInfoOpen = true;
		isSessionInfoLoading = true;
		sessionInfoError = '';

		try {
			const response = await fetch(`/api/sessions/${encodeURIComponent(identity.sessionId)}`);
			if (!response.ok) {
				throw new Error(`Failed to load session info (${response.status})`);
			}

			sessionInfo = (await response.json()) as SessionInfoResponse;
		} catch (err) {
			sessionInfo = null;
			sessionInfoError = err instanceof Error ? err.message : 'Failed to load session info';
		} finally {
			isSessionInfoLoading = false;
		}
	}

	function closeSessionInfoModal() {
		isSessionInfoOpen = false;
	}
</script>

<nav>
	{#if $sessionIdentity}
		<button type="button" class="nav-action session-shorthand scope-viewer mr-auto" title="Information about your PeerLens session" onclick={openSessionInfoModal}>
			<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="currentColor" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M19 9H6.65856C5.65277 9 5.14987 9 5.02472 8.69134C4.89957 8.38268 5.25517 8.01942 5.96637 7.29289L8.21091 5" />
					<path d="M5 15H17.3414C18.3472 15 18.8501 15 18.9753 15.3087C19.1004 15.6173 18.7448 15.9806 18.0336 16.7071L15.7891 19" />
			</svg>
			{$sessionIdentity.shorthand}
		</button>
	{/if}

	<a href="/viewer" class="scope-viewer">
		Viewer
	</a>

	<a href="/" class="brand-link" aria-label="PeerLens home">
		<img src="/logo/logo.svg" class="brand" alt="PeerLens logo" />
	</a>

	<a href="/phone" class="scope-phone">
		Phone
	</a>

	{#if $sessionIdentity}
		<button type="button" class="nav-action session-shorthand scope-phone ml-auto" title="Information about your PeerLens session" onclick={openSessionInfoModal}>
			<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" color="currentColor" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 9H6.65856C5.65277 9 5.14987 9 5.02472 8.69134C4.89957 8.38268 5.25517 8.01942 5.96637 7.29289L8.21091 5" />
				<path d="M5 15H17.3414C18.3472 15 18.8501 15 18.9753 15.3087C19.1004 15.6173 18.7448 15.9806 18.0336 16.7071L15.7891 19" />
			</svg>
			{$sessionIdentity.shorthand}
		</button>
	{/if}
</nav>

{#if isSessionInfoOpen}
	<div class="session-modal-backdrop" role="presentation">
		<div
			class="session-modal"
			role="dialog"
			aria-modal="true"
			aria-label="Session information"
		>
			<div class="session-modal-header">
				<h2>Session details</h2>
				<button
					type="button"
					class="session-modal-close"
					onclick={closeSessionInfoModal}
					aria-label="Close session information"
				>
					×
				</button>
			</div>

			<p>
				ID: {$sessionIdentity?.sessionId ?? '—'}
			</p>

			{#if isSessionInfoLoading}
				<p>Loading session data…</p>
			{:else if sessionInfoError}
				<p class="session-modal-error">{sessionInfoError}</p>
			{:else if sessionInfo}
				<dl class="session-modal-summary">
					<div>
						<dt>Viewer state</dt>
						<dd>{sessionInfo.viewerState ?? '—'}</dd>
					</div>
					<div>
						<dt>Phone state</dt>
						<dd>{sessionInfo.phoneState ?? '—'}</dd>
					</div>
					<div>
						<dt>Created</dt>
						<dd>{formatUnixTimestamp(sessionInfo.createdAt)}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>{formatUnixTimestamp(sessionInfo.updatedAt)}</dd>
					</div>
					<div>
						<dt>Expires at</dt>
						<dd>{formatUnixTimestamp(sessionInfo.expiresAt)}</dd>
					</div>
					<div>
						<dt>Connected at</dt>
						<dd>{formatUnixTimestamp(sessionInfo.connectedAt)}</dd>
					</div>
				</dl>

				<Collapsible title="Session offer SDP">
					<div class="code">{sessionInfo.offer?.sdp ?? 'No offer SDP available.'}</div>
				</Collapsible>

				<Collapsible title="Session answer SDP">
					<div class="code">{sessionInfo.answer?.sdp ?? 'No answer SDP available.'}</div>
				</Collapsible>
			{/if}

			<Collapsible title="Local session log">
				<div class="session-log-table-wrap">
					<table class="session-log-table">
						<thead>
							<tr>
								<th scope="col">Time</th>
								<th scope="col">Message</th>
							</tr>
						</thead>
						<tbody>
							{#if $sessionIdentity?.log.length}
								{#each [...$sessionIdentity.log].reverse() as entry}
									<tr>
										<td>{entry.datetime}</td>
										<td>{entry.message}</td>
									</tr>
								{/each}
							{:else}
								<tr>
									<td colspan="2">No local log entries yet.</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</Collapsible>
		</div>
	</div>
{/if}
