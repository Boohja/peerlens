import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addIceCandidate, getIceCandidatesForPeer } from '$lib/server/ice-candidate-store';
import { getSession } from '$lib/server/session-store';
import { checkRateLimit } from '$lib/server/rate-limit';

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

export const GET: RequestHandler = async (event) => {
	const limitResult = checkRateLimit(event, {
		bucket: 'sessions:ice:get',
		windowMs: 60_000,
		maxRequests: 300
	});

	if (!limitResult.allowed) {
		throw error(429, `Too many requests. Retry in ${limitResult.retryAfterSeconds}s`);
	}

	const { params, url } = event;
	const sessionId = sessionIdOrThrow(params.sessionId);

	if (!(await getSession(sessionId))) {
		throw error(404, 'Session not found');
	}

	const recipientRole = normalizeRole(url.searchParams.get('for'));
	const after = parseInteger(url.searchParams.get('after'), 0);
	const limit = parseInteger(url.searchParams.get('limit'), 100);

	const candidates = await getIceCandidatesForPeer(sessionId, recipientRole, after, limit);
	const nextAfter = candidates.length > 0 ? (candidates.at(-1)?.id ?? after) : after;

	return json({ sessionId, candidates, nextAfter });
};

export const POST: RequestHandler = async (event) => {
	const limitResult = checkRateLimit(event, {
		bucket: 'sessions:ice:post',
		windowMs: 60_000,
		maxRequests: 240
	});

	if (!limitResult.allowed) {
		throw error(429, `Too many requests. Retry in ${limitResult.retryAfterSeconds}s`);
	}

	const { params, request } = event;
	const sessionId = sessionIdOrThrow(params.sessionId);
	const payload = (await request.json().catch(() => null)) as
		| { role?: unknown; candidate?: unknown }
		| null;

	if (!payload) {
		throw error(400, 'Request body must be valid JSON');
	}

	const role = normalizeRole(payload.role);
	if (!Object.hasOwn(payload, 'candidate')) {
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
