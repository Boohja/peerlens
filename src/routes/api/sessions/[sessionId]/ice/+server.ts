import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addIceCandidate, getIceCandidatesForPeer, getSession } from '$lib/server/ice-store';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

function normalizeRole(value: unknown): 'viewer' | 'phone' {
	if (value === 'viewer' || value === 'phone') {
		return value;
	}

	throw error(400, 'Role must be "viewer" or "phone"');
}

function parseInteger(value: string | null, fallback: number): number {
	if (value === null || value.trim() === '') return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw error(400, 'Invalid numeric query parameter');
	}

	return parsed;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);

	if (!(await getSession(sessionId))) {
		throw error(404, 'Session not found');
	}

	const recipientRole = normalizeRole(url.searchParams.get('for'));
	const after = parseInteger(url.searchParams.get('after'), 0);
	const limit = parseInteger(url.searchParams.get('limit'), 100);

	const candidates = await getIceCandidatesForPeer(sessionId, recipientRole, after, limit);
	const nextAfter = candidates.length > 0 ? candidates[candidates.length - 1].id : after;

	return json({ sessionId, candidates, nextAfter });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const sessionId = sessionIdOrThrow(params.sessionId);
	const payload = (await request.json().catch(() => null)) as
		| { role?: unknown; candidate?: unknown }
		| null;

	if (!payload) {
		throw error(400, 'Request body must be valid JSON');
	}

	const role = normalizeRole(payload.role);
	if (!Object.prototype.hasOwnProperty.call(payload, 'candidate')) {
		throw error(400, 'Missing ICE candidate payload');
	}

	let id = 0;
	try {
		id = await addIceCandidate(sessionId, role, payload.candidate);
	} catch {
		throw error(404, 'Session not found or expired');
	}

	return json({ sessionId, id, ok: true }, { status: 201 });
};
