import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOrTouchSession } from '$lib/server/ice-store';

function normalizeSessionId(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const sessionId = value.trim();
	if (!sessionId) return null;
	if (sessionId.length > 128) return null;
	return sessionId;
}

function generateSessionId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const POST: RequestHandler = async ({ request }) => {
	let payload: unknown = {};

	if (request.headers.get('content-type')?.includes('application/json')) {
		payload = await request.json().catch(() => ({}));
	}

	const requestedSessionId =
		typeof payload === 'object' && payload !== null
			? normalizeSessionId((payload as { sessionId?: unknown }).sessionId)
			: null;

	const sessionId = requestedSessionId || generateSessionId();
	await createOrTouchSession(sessionId);

	return json({ sessionId });
};
