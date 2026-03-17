import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { markSessionAsConnected, getSession } from '$lib/server/session-store';
import { checkRateLimit } from '$lib/server/rate-limit';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

export const POST: RequestHandler = async (event) => {
	const limit = checkRateLimit(event, {
		bucket: 'sessions:connected:post',
		windowMs: 60_000,
		maxRequests: 90
	});

	if (!limit.allowed) {
		throw error(429, `Too many requests. Retry in ${limit.retryAfterSeconds}s`);
	}

	const { params } = event;
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
