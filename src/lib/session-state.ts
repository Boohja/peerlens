export type ClientSessionRole = 'viewer' | 'phone';
export type ClientSessionPartyState = 'offered' | 'waiting' | 'party' | 'left';

export async function patchSessionRoleState(
	sessionId: string,
	actor: ClientSessionRole,
	nextState: ClientSessionPartyState
) {
	if (!sessionId) return;

	try {
		const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/state`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ actor, nextState })
		});

		if (!response.ok && response.status !== 409) {
			console.warn(`Failed to update ${actor} state (${nextState}):`, response.status);
		}
	} catch (err) {
		console.error(`Failed to update ${actor} state (${nextState}):`, err);
	}
}