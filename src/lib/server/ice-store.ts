import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, type InValue, type Row } from '@libsql/client';

export type PeerRole = 'viewer' | 'phone';
export type SessionDescriptionType = 'offer' | 'answer';
export type SessionRole = 'viewer' | 'phone';
export type SessionPartyState = 'offered' | 'waiting' | 'party' | 'left';

const SESSION_PARTY_STATE_VALUES = ['offered', 'waiting', 'party', 'left'] as const;

export interface StoredSessionDescription {
	type: SessionDescriptionType;
	sdp: string;
}

export interface StoredIceCandidate {
	id: number;
	role: PeerRole;
	candidate: unknown;
	createdAt: number;
}

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

interface SessionStateSnapshot {
	viewerState: SessionPartyState | null;
	phoneState: SessionPartyState | null;
	stateVersion: number;
	viewerStateAt: number | null;
	phoneStateAt: number | null;
}

const OFFER_TTL_SECONDS = Number.parseInt(process.env.PEERLENS_OFFER_TTL_SECONDS || '600', 10) || 600;
const CLEANUP_INTERVAL_SECONDS =
	Number.parseInt(process.env.PEERLENS_CLEANUP_INTERVAL_SECONDS || '60', 10) || 60;
const UNCONNECTED_SESSION_TTL_SECONDS =
	Number.parseInt(process.env.PEERLENS_UNCONNECTED_SESSION_TTL_SECONDS || '120', 10) || 120;
const CONNECTED_SESSION_TTL_SECONDS =
	Number.parseInt(process.env.PEERLENS_CONNECTED_SESSION_TTL_SECONDS || '7200', 10) || 7200;
const ICE_MAX_AGE_SECONDS = Number.parseInt(process.env.PEERLENS_ICE_MAX_AGE_SECONDS || '1200', 10) || 1200;
const ICE_MAX_CANDIDATES_PER_ROLE =
	Number.parseInt(process.env.PEERLENS_ICE_MAX_CANDIDATES_PER_ROLE || '64', 10) || 64;

const configuredPath = (process.env.PEERLENS_DB_PATH || '').trim();
const dbFilePath = resolve(configuredPath || '.data/peerlens.sqlite');

mkdirSync(dirname(dbFilePath), { recursive: true });

const client = createClient({ url: `file:${dbFilePath}` });

let initialized: Promise<void> | null = null;
let nextCleanupAtMs = 0;

function asString(value: InValue): string | null {
	if (typeof value === 'string') {
		return value;
	}

	return null;
}

function asSessionPartyState(value: InValue): SessionPartyState | null {
	const state = asString(value);
	if (!state) {
		return null;
	}

	if (SESSION_PARTY_STATE_VALUES.includes(state as SessionPartyState)) {
		return state as SessionPartyState;
	}

	return null;
}

function asNumber(value: InValue): number {
	if (typeof value === 'number') {
		return value;
	}

	if (typeof value === 'bigint') {
		return Number(value);
	}

	throw new Error('Unexpected non-numeric SQLite value');
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
	const result = await client.execute({
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
		await client.execute({ sql: `DELETE FROM sessions WHERE session_id = ?`, args: [sessionId] });
		return null;
	}

	return row;
}

async function cleanupIfDue(force = false): Promise<void> {
	const now = Date.now();
	if (!force && now < nextCleanupAtMs) {
		return;
	}

	nextCleanupAtMs = now + CLEANUP_INTERVAL_SECONDS * 1000;

	// Delete sessions with explicit expiry that have passed
	await client.execute({
		sql: `
			DELETE FROM sessions
			WHERE expires_at IS NOT NULL AND expires_at <= unixepoch()
		`
	});

	// Delete unconnected sessions (no answer and no connected marker) after 2 minutes.
	await client.execute({
		sql: `
			DELETE FROM sessions
			WHERE connected_at IS NULL
			  AND answer_sdp IS NULL
			  AND created_at <= unixepoch() - ?
		`,
		args: [UNCONNECTED_SESSION_TTL_SECONDS]
	});

	// Delete established sessions (connected marker or answer present) after 2 hours,
	// measured from connected_at when present, otherwise from last update.
	await client.execute({
		sql: `
			DELETE FROM sessions
			WHERE (connected_at IS NOT NULL OR answer_sdp IS NOT NULL)
			  AND COALESCE(connected_at, updated_at) <= unixepoch() - ?
		`,
		args: [CONNECTED_SESSION_TTL_SECONDS]
	});

	await client.execute({
		sql: `DELETE FROM ice_candidates WHERE created_at <= unixepoch() - ?`,
		args: [ICE_MAX_AGE_SECONDS]
	});

	await client.execute({
		sql: `
			DELETE FROM sessions
			WHERE offer_sdp IS NULL
			  AND created_at <= unixepoch() - ?
		`,
		args: [OFFER_TTL_SECONDS]
	});
}

async function ensureInitialized(): Promise<void> {
	initialized ??= (async () => {
			await client.execute('PRAGMA journal_mode = WAL;');
			await client.execute('PRAGMA foreign_keys = ON;');

			await client.execute(`
				CREATE TABLE IF NOT EXISTS sessions (
					session_id TEXT PRIMARY KEY,
					offer_sdp TEXT,
					answer_sdp TEXT,
					expires_at INTEGER,
					connected_at INTEGER,
					viewer_state TEXT CHECK(viewer_state IN ('offered', 'waiting', 'party', 'left')),
					phone_state TEXT CHECK(phone_state IN ('offered', 'waiting', 'party', 'left')),
					state_version INTEGER NOT NULL DEFAULT 0,
					viewer_state_at INTEGER,
					phone_state_at INTEGER,
					created_at INTEGER NOT NULL DEFAULT (unixepoch()),
					updated_at INTEGER NOT NULL DEFAULT (unixepoch())
				);
			`);

			const sessionColumns = await client.execute(`PRAGMA table_info(sessions)`);
			const hasExpiresAt = sessionColumns.rows.some((row) => asString(row.name) === 'expires_at');
			if (!hasExpiresAt) {
				await client.execute(`ALTER TABLE sessions ADD COLUMN expires_at INTEGER`);
			}

			const hasConnectedAt = sessionColumns.rows.some((row) => asString(row.name) === 'connected_at');
			if (!hasConnectedAt) {
				await client.execute(`ALTER TABLE sessions ADD COLUMN connected_at INTEGER`);
			}

			const hasViewerState = sessionColumns.rows.some((row) => asString(row.name) === 'viewer_state');
			if (!hasViewerState) {
				await client.execute(
					`ALTER TABLE sessions ADD COLUMN viewer_state TEXT CHECK(viewer_state IN ('offered', 'waiting', 'party', 'left'))`
				);
			}

			const hasPhoneState = sessionColumns.rows.some((row) => asString(row.name) === 'phone_state');
			if (!hasPhoneState) {
				await client.execute(
					`ALTER TABLE sessions ADD COLUMN phone_state TEXT CHECK(phone_state IN ('offered', 'waiting', 'party', 'left'))`
				);
			}

			const hasStateVersion = sessionColumns.rows.some((row) => asString(row.name) === 'state_version');
			if (!hasStateVersion) {
				await client.execute(`ALTER TABLE sessions ADD COLUMN state_version INTEGER NOT NULL DEFAULT 0`);
			}

			const hasViewerStateAt = sessionColumns.rows.some((row) => asString(row.name) === 'viewer_state_at');
			if (!hasViewerStateAt) {
				await client.execute(`ALTER TABLE sessions ADD COLUMN viewer_state_at INTEGER`);
			}

			const hasPhoneStateAt = sessionColumns.rows.some((row) => asString(row.name) === 'phone_state_at');
			if (!hasPhoneStateAt) {
				await client.execute(`ALTER TABLE sessions ADD COLUMN phone_state_at INTEGER`);
			}

			await client.execute(`UPDATE sessions SET state_version = 0 WHERE state_version IS NULL`);

			await client.execute(`
				CREATE TABLE IF NOT EXISTS ice_candidates (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					session_id TEXT NOT NULL,
					role TEXT NOT NULL CHECK(role IN ('viewer', 'phone')),
					candidate_json TEXT NOT NULL,
					created_at INTEGER NOT NULL DEFAULT (unixepoch()),
					FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
				);
			`);

			await client.execute(`
				CREATE INDEX IF NOT EXISTS idx_ice_candidates_session_id_id
				ON ice_candidates(session_id, id);
			`);

			await client.execute(`
				CREATE UNIQUE INDEX IF NOT EXISTS idx_ice_candidates_unique
				ON ice_candidates(session_id, role, candidate_json);
			`);

			await client.execute(`
				CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
				ON sessions(expires_at);
			`);

			await cleanupIfDue(true);
		})();

	await initialized;
}

export async function createOrTouchSession(sessionId: string): Promise<void> {
	await ensureInitialized();
	await cleanupIfDue();
	await client.execute({
		sql: `
			INSERT INTO sessions(session_id, updated_at)
			VALUES (?, unixepoch())
			ON CONFLICT(session_id) DO UPDATE SET updated_at = unixepoch()
		`,
		args: [sessionId]
	});
}

export async function getSession(sessionId: string): Promise<{
	sessionId: string;
	offer: StoredSessionDescription | null;
	answer: StoredSessionDescription | null;
	expiresAt: number | null;
	connectedAt: number | null;
	viewerState: SessionPartyState | null;
	phoneState: SessionPartyState | null;
	stateVersion: number;
	viewerStateAt: number | null;
	phoneStateAt: number | null;
	createdAt: number;
	updatedAt: number;
} | null> {
	await ensureInitialized();
	await cleanupIfDue();
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
	await ensureInitialized();
	await cleanupIfDue();

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

	await client.execute({
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
	await ensureInitialized();
	await cleanupIfDue();

	if (type === 'offer') {
		await createOrTouchSession(sessionId);
		await client.execute({
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
		await client.execute({
			sql: `DELETE FROM ice_candidates WHERE session_id = ?`,
			args: [sessionId]
		});
		return;
	}

	const row = await getSessionRow(sessionId);
	if (!row?.offer_sdp) {
		throw new Error('Session not found');
	}

	await client.execute({
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

export async function addIceCandidate(
	sessionId: string,
	role: PeerRole,
	candidate: unknown
): Promise<number> {
	await ensureInitialized();
	await cleanupIfDue();
	const row = await getSessionRow(sessionId);
	if (!row?.offer_sdp) {
		throw new Error('Session not found');
	}

	const candidateJson = JSON.stringify(candidate);

	const result = await client.execute({
		sql: `INSERT OR IGNORE INTO ice_candidates(session_id, role, candidate_json) VALUES (?, ?, ?)`,
		args: [sessionId, role, candidateJson]
	});

	await client.execute({
		sql: `
			DELETE FROM ice_candidates
			WHERE session_id = ?
			  AND role = ?
			  AND id NOT IN (
				SELECT id
				FROM ice_candidates
				WHERE session_id = ?
				  AND role = ?
				ORDER BY id DESC
				LIMIT ?
			  )
		`,
		args: [sessionId, role, sessionId, role, Math.max(8, ICE_MAX_CANDIDATES_PER_ROLE)]
	});

	if ((result.rowsAffected ?? 0) === 0) {
		const existing = await client.execute({
			sql: `
				SELECT id
				FROM ice_candidates
				WHERE session_id = ?
				  AND role = ?
				  AND candidate_json = ?
				ORDER BY id DESC
				LIMIT 1
			`,
			args: [sessionId, role, candidateJson]
		});

		const existingRow = existing.rows[0];
		if (existingRow) {
			return asNumber(existingRow.id);
		}
	}

	return asNumber(result.lastInsertRowid ?? 0);
}

export async function getIceCandidatesForPeer(
	sessionId: string,
	recipientRole: PeerRole,
	afterId = 0,
	limit = 100
): Promise<StoredIceCandidate[]> {
	await ensureInitialized();
	await cleanupIfDue();
	const row = await getSessionRow(sessionId);
	if (!row?.offer_sdp) {
		return [];
	}

	const result = await client.execute({
		sql: `
			SELECT id, role, candidate_json, created_at
			FROM ice_candidates
			WHERE session_id = ?
			  AND role != ?
			  AND id > ?
			ORDER BY id ASC
			LIMIT ?
		`,
		args: [sessionId, recipientRole, afterId, Math.max(1, Math.min(limit, 500))]
	});

	const rows = result.rows;

	return rows.map((row) => ({
		id: asNumber(row.id),
		role: (asString(row.role) as PeerRole) || recipientRole,
		candidate: JSON.parse(asString(row.candidate_json) || 'null'),
		createdAt: asNumber(row.created_at)
	}));
}

export async function removeSession(sessionId: string): Promise<boolean> {
	await ensureInitialized();
	await cleanupIfDue();
	const result = await client.execute({
		sql: `DELETE FROM sessions WHERE session_id = ?`,
		args: [sessionId]
	});

	return (result.rowsAffected ?? 0) > 0;
}

export async function markSessionAsConnected(sessionId: string): Promise<boolean> {
	await ensureInitialized();
	await cleanupIfDue();
	const result = await client.execute({
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
