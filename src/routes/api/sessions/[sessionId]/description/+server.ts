import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession, setSessionDescription } from '$lib/server/ice-store';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

function normalizeDescriptionType(value: unknown): 'offer' | 'answer' {
	if (value === 'offer' || value === 'answer') {
		return value;
	}

	throw error(400, 'Description type must be "offer" or "answer"');
}

function normalizeSdp(value: unknown): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw error(400, 'SDP must be a non-empty string');
	}

	return value;
}

export const GET: RequestHandler = async ({ params }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);
	const session = await getSession(sessionId);

	if (!session) {
		throw error(404, 'Session not found');
	}

	return json({
		sessionId,
		offer: session.offer,
		answer: session.answer,
		expiresAt: session.expiresAt,
		updatedAt: session.updatedAt
	});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);
	const payload = (await request.json().catch(() => null)) as
		| { type?: unknown; sdp?: unknown }
		| null;

	if (!payload) {
		throw error(400, 'Request body must be valid JSON');
	}

	const type = normalizeDescriptionType(payload.type);
	const sdp = normalizeSdp(payload.sdp);

	try {
		await setSessionDescription(sessionId, type, sdp);
	} catch {
		throw error(404, 'Session not found or expired');
	}

	return json({ sessionId, type, ok: true });
};
