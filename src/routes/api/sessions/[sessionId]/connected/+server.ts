import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markSessionAsConnected, getSession } from '$lib/server/ice-store';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

export const POST: RequestHandler = async ({ params }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);

	// Verify session exists
	const session = await getSession(sessionId);
	if (!session) {
		throw error(404, 'Session not found');
	}

	// Mark as connected (only marks once)
	await markSessionAsConnected(sessionId);

	return json({ sessionId, ok: true });
};
