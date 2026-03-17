import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOrTouchSession } from '$lib/server/session-store';
import { checkRateLimit } from '$lib/server/rate-limit';

function generateSessionId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const POST: RequestHandler = async (event) => {
	const limit = checkRateLimit(event, {
		bucket: 'sessions:create',
		windowMs: 60_000,
		maxRequests: 20
	});

	if (!limit.allowed) {
		return json({ message: 'Too many requests', retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });
	}

	const sessionId = generateSessionId();
	await createOrTouchSession(sessionId);

	return json({ sessionId });
};
