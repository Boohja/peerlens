import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession, removeSession } from '$lib/server/session-store';
import { checkRateLimit } from '$lib/server/rate-limit';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

export const GET: RequestHandler = async (event) => {
	const limit = checkRateLimit(event, {
		bucket: 'sessions:get',
		windowMs: 60_000,
		maxRequests: 180
	});

	if (!limit.allowed) {
		throw error(429, `Too many requests. Retry in ${limit.retryAfterSeconds}s`);
	}

	const { params } = event;
	const sessionId = sessionIdOrThrow(params.sessionId);
	const session = await getSession(sessionId);

	if (!session) {
		throw error(404, 'Session not found');
	}

	return json(session);
};

export const DELETE: RequestHandler = async (event) => {
	const limit = checkRateLimit(event, {
		bucket: 'sessions:delete',
		windowMs: 60_000,
		maxRequests: 20
	});

	if (!limit.allowed) {
		throw error(429, `Too many requests. Retry in ${limit.retryAfterSeconds}s`);
	}

	const { params } = event;
	const sessionId = sessionIdOrThrow(params.sessionId);
	const removed = await removeSession(sessionId);

	if (!removed) {
		throw error(404, 'Session not found');
	}

	return new Response(null, { status: 204 });
};
