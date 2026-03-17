import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/server/rate-limit';
import {
	getSession,
	setSessionRoleState,
	type SessionPartyState,
	type SessionRole
} from '$lib/server/session-store';

function sessionIdOrThrow(raw: string): string {
	const sessionId = raw.trim();
	if (!sessionId || sessionId.length > 128) {
		throw error(400, 'Invalid session ID');
	}

	return sessionId;
}

function normalizeRole(value: unknown): SessionRole {
	if (value === 'viewer' || value === 'phone') {
		return value;
	}

	throw error(400, 'Actor must be "viewer" or "phone"');
}

function normalizeState(value: unknown): SessionPartyState {
	if (value === 'offered' || value === 'waiting' || value === 'party' || value === 'left') {
		return value;
	}

	throw error(400, 'State must be "offered", "waiting", "party", or "left"');
}

function normalizeExpectedVersion(value: unknown): number | undefined {
	if (value == null) {
		return undefined;
	}

	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		throw error(400, 'expectedVersion must be a non-negative integer when provided');
	}

	return value;
}

export const GET: RequestHandler = async (event) => {
	const limit = checkRateLimit(event, {
		bucket: 'sessions:state:get',
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

	return json({
		sessionId,
		viewerState: session.viewerState,
		phoneState: session.phoneState,
		stateVersion: session.stateVersion,
		viewerStateAt: session.viewerStateAt,
		phoneStateAt: session.phoneStateAt,
		updatedAt: session.updatedAt
	});
};

export const PATCH: RequestHandler = async (event) => {
	const limit = checkRateLimit(event, {
		bucket: 'sessions:state:patch',
		windowMs: 60_000,
		maxRequests: 120
	});

	if (!limit.allowed) {
		throw error(429, `Too many requests. Retry in ${limit.retryAfterSeconds}s`);
	}

	const { params, request } = event;
	const sessionId = sessionIdOrThrow(params.sessionId);
	const payload = (await request.json().catch(() => null)) as
		| { actor?: unknown; nextState?: unknown; expectedVersion?: unknown }
		| null;

	if (!payload) {
		throw error(400, 'Request body must be valid JSON');
	}

	const actor = normalizeRole(payload.actor);
	const nextState = normalizeState(payload.nextState);
	const expectedVersion = normalizeExpectedVersion(payload.expectedVersion);

	try {
		const snapshot = await setSessionRoleState(sessionId, actor, nextState, expectedVersion);
		return json({ sessionId, ...snapshot, ok: true });
	} catch (err) {
		if (err instanceof Error) {
			if (err.message === 'SESSION_NOT_FOUND') {
				throw error(404, 'Session not found');
			}

			if (err.message === 'STATE_VERSION_CONFLICT') {
				const current = await getSession(sessionId);
				return json(
					{
						message: 'State version conflict',
						viewerState: current?.viewerState ?? null,
						phoneState: current?.phoneState ?? null,
						stateVersion: current?.stateVersion ?? 0
					},
					{ status: 409 }
				);
			}

			if (err.message === 'INVALID_STATE_TRANSITION') {
				throw error(409, 'Invalid state transition');
			}
		}

		throw error(500, 'Failed to update session state');
	}
};
