import type { Row } from '@libsql/client';
import {
	UNCONNECTED_SESSION_TTL_SECONDS,
	asNumber,
	asString,
	cleanupSignalingIfDue,
	ensureSignalingInitialized,
	signalingClient
} from './signaling-db';
import type {
	SessionDescriptionType,
	SessionPartyState,
	SessionRole,
	SessionStateSnapshot,
	StoredSession
} from './signaling-types';

export type {
	SessionDescriptionType,
	SessionPartyState,
	SessionRole,
	SessionStateSnapshot,
	StoredSession
} from './signaling-types';

const SESSION_PARTY_STATE_VALUES = ['offered', 'waiting', 'party', 'left'] as const;

interface SessionRow {
	session_id: string;
	offer_sdp: string | null;
	answer_sdp: string | null;
	expires_at: number | null;
	connected_at: number | null;
	viewer_state: SessionPartyState | null;
	phone_state: SessionPartyState | null;
	state_version: number;
	viewer_state_at: number | null;
	phone_state_at: number | null;
	created_at: number;
	updated_at: number;
}

function asSessionPartyState(value: unknown): SessionPartyState | null {
	const state = asString(value as Parameters<typeof asString>[0]);
	if (!state) {
		return null;
	}

	if (SESSION_PARTY_STATE_VALUES.includes(state as SessionPartyState)) {
		return state as SessionPartyState;
	}

	return null;
}

function mapSessionRow(row: Row): SessionRow {
	return {
		session_id: asString(row.session_id) || '',
		offer_sdp: asString(row.offer_sdp),
		answer_sdp: asString(row.answer_sdp),
		expires_at: row.expires_at == null ? null : asNumber(row.expires_at),
		connected_at: row.connected_at == null ? null : asNumber(row.connected_at),
		viewer_state: asSessionPartyState(row.viewer_state),
		phone_state: asSessionPartyState(row.phone_state),
		state_version: row.state_version == null ? 0 : asNumber(row.state_version),
		viewer_state_at: row.viewer_state_at == null ? null : asNumber(row.viewer_state_at),
		phone_state_at: row.phone_state_at == null ? null : asNumber(row.phone_state_at),
		created_at: asNumber(row.created_at),
		updated_at: asNumber(row.updated_at)
	};
}

function mapStateSnapshot(row: SessionRow): SessionStateSnapshot {
	return {
		viewerState: row.viewer_state,
		phoneState: row.phone_state,
		stateVersion: row.state_version,
		viewerStateAt: row.viewer_state_at,
		phoneStateAt: row.phone_state_at
	};
}

function canTransitionState(
	role: SessionRole,
	current: SessionPartyState | null,
	next: SessionPartyState
): boolean {
	if (current === next) {
		return true;
	}

	if (next === 'left') {
		return current !== 'left';
	}

	if (current === 'left') {
		return false;
	}

	if (role === 'viewer') {
		if (current === null) return next === 'offered';
		if (current === 'offered') return next === 'party';
		if (current === 'party') return next === 'waiting';
		if (current === 'waiting') return next === 'offered' || next === 'party';
		return false;
	}

	if (current === null) return next === 'party';
	if (current === 'party') return next === 'waiting';
	if (current === 'waiting') return next === 'party';
	return false;
}

function unixNow(): number {
	return Math.floor(Date.now() / 1000);
}

function isExpired(row: SessionRow): boolean {
	if (row.expires_at == null) {
		return false;
	}

	return row.expires_at <= unixNow();
}

async function getSessionRow(sessionId: string): Promise<SessionRow | null> {
	const result = await signalingClient.execute({
		sql: `
			SELECT
				session_id,
				offer_sdp,
				answer_sdp,
				expires_at,
				connected_at,
				viewer_state,
				phone_state,
				state_version,
				viewer_state_at,
				phone_state_at,
				created_at,
				updated_at
			FROM sessions
			WHERE session_id = ?
		`,
		args: [sessionId]
	});

	const rawRow = result.rows[0];
	if (!rawRow) {
		return null;
	}

	const row = mapSessionRow(rawRow);
	if (!row.session_id) {
		return null;
	}

	if (isExpired(row)) {
		await signalingClient.execute({ sql: `DELETE FROM sessions WHERE session_id = ?`, args: [sessionId] });
		return null;
	}

	return row;
}

export async function createOrTouchSession(sessionId: string): Promise<void> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();
	await signalingClient.execute({
		sql: `
			INSERT INTO sessions(session_id, updated_at)
			VALUES (?, unixepoch())
			ON CONFLICT(session_id) DO UPDATE SET updated_at = unixepoch()
		`,
		args: [sessionId]
	});
}

export async function getSession(sessionId: string): Promise<StoredSession | null> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();
	const row = await getSessionRow(sessionId);

	if (!row) {
		return null;
	}

	return {
		sessionId: row.session_id,
		offer: row.offer_sdp ? { type: 'offer', sdp: row.offer_sdp } : null,
		answer: row.answer_sdp ? { type: 'answer', sdp: row.answer_sdp } : null,
		expiresAt: row.expires_at,
		connectedAt: row.connected_at,
		viewerState: row.viewer_state,
		phoneState: row.phone_state,
		stateVersion: row.state_version,
		viewerStateAt: row.viewer_state_at,
		phoneStateAt: row.phone_state_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export async function setSessionRoleState(
	sessionId: string,
	actor: SessionRole,
	nextState: SessionPartyState,
	expectedVersion?: number
): Promise<SessionStateSnapshot> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();

	const row = await getSessionRow(sessionId);
	if (!row) {
		throw new Error('SESSION_NOT_FOUND');
	}

	if (expectedVersion != null && row.state_version !== expectedVersion) {
		throw new Error('STATE_VERSION_CONFLICT');
	}

	const currentState = actor === 'viewer' ? row.viewer_state : row.phone_state;
	if (!canTransitionState(actor, currentState, nextState)) {
		throw new Error('INVALID_STATE_TRANSITION');
	}

	const roleColumn = actor === 'viewer' ? 'viewer_state' : 'phone_state';
	const roleAtColumn = actor === 'viewer' ? 'viewer_state_at' : 'phone_state_at';

	await signalingClient.execute({
		sql: `
			UPDATE sessions
			SET
				${roleColumn} = ?,
				${roleAtColumn} = unixepoch(),
				state_version = state_version + 1,
				updated_at = unixepoch()
			WHERE session_id = ?
		`,
		args: [nextState, sessionId]
	});

	const updatedRow = await getSessionRow(sessionId);
	if (!updatedRow) {
		throw new Error('SESSION_NOT_FOUND');
	}

	return mapStateSnapshot(updatedRow);
}

export async function setSessionDescription(
	sessionId: string,
	type: SessionDescriptionType,
	sdp: string
): Promise<void> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();

	if (type === 'offer') {
		await createOrTouchSession(sessionId);
		await signalingClient.execute({
			sql: `
				UPDATE sessions
				SET
					offer_sdp = ?,
					answer_sdp = NULL,
					connected_at = NULL,
					viewer_state = 'offered',
					viewer_state_at = unixepoch(),
					phone_state = CASE WHEN phone_state = 'left' THEN phone_state ELSE NULL END,
					phone_state_at = CASE WHEN phone_state = 'left' THEN phone_state_at ELSE NULL END,
					state_version = state_version + 1,
					expires_at = unixepoch() + ?,
					updated_at = unixepoch()
				WHERE session_id = ?
			`,
			args: [sdp, UNCONNECTED_SESSION_TTL_SECONDS, sessionId]
		});
		await signalingClient.execute({
			sql: `DELETE FROM ice_candidates WHERE session_id = ?`,
			args: [sessionId]
		});
		return;
	}

	const row = await getSessionRow(sessionId);
	if (!row?.offer_sdp) {
		throw new Error('Session not found');
	}

	await signalingClient.execute({
		sql: `
			UPDATE sessions
			SET
				answer_sdp = ?,
				phone_state = CASE WHEN phone_state IS NULL THEN 'waiting' ELSE phone_state END,
				phone_state_at = CASE WHEN phone_state IS NULL THEN unixepoch() ELSE phone_state_at END,
				state_version = CASE WHEN phone_state IS NULL THEN state_version + 1 ELSE state_version END,
				updated_at = unixepoch()
			WHERE session_id = ?
		`,
		args: [sdp, sessionId]
	});
}

export async function removeSession(sessionId: string): Promise<boolean> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();
	const result = await signalingClient.execute({
		sql: `DELETE FROM sessions WHERE session_id = ?`,
		args: [sessionId]
	});

	return (result.rowsAffected ?? 0) > 0;
}

export async function markSessionAsConnected(sessionId: string): Promise<boolean> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();
	const result = await signalingClient.execute({
		sql: `
			UPDATE sessions
			SET
				connected_at = COALESCE(connected_at, unixepoch()),
				viewer_state = 'party',
				phone_state = 'party',
				viewer_state_at = COALESCE(viewer_state_at, unixepoch()),
				phone_state_at = COALESCE(phone_state_at, unixepoch()),
				state_version = state_version + 1,
				expires_at = NULL,
				updated_at = unixepoch()
			WHERE session_id = ?
		`,
		args: [sessionId]
	});

	return (result.rowsAffected ?? 0) > 0;
}
