import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession, removeSession } from '$lib/server/ice-store';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

export const GET: RequestHandler = async ({ params }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);
	const session = await getSession(sessionId);

	if (!session) {
		throw error(404, 'Session not found');
	}

	return json(session);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);
	const removed = await removeSession(sessionId);

	if (!removed) {
		throw error(404, 'Session not found');
	}

	return new Response(null, { status: 204 });
};
