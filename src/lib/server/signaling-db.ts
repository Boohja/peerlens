import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, type InValue } from '@libsql/client';

const OFFER_TTL_SECONDS = Number.parseInt(process.env.PEERLENS_OFFER_TTL_SECONDS || '600', 10) || 600;
const CLEANUP_INTERVAL_SECONDS =
	Number.parseInt(process.env.PEERLENS_CLEANUP_INTERVAL_SECONDS || '60', 10) || 60;
export const UNCONNECTED_SESSION_TTL_SECONDS =
	Number.parseInt(process.env.PEERLENS_UNCONNECTED_SESSION_TTL_SECONDS || '120', 10) || 120;
const CONNECTED_SESSION_TTL_SECONDS =
	Number.parseInt(process.env.PEERLENS_CONNECTED_SESSION_TTL_SECONDS || '7200', 10) || 7200;
export const ICE_MAX_AGE_SECONDS =
	Number.parseInt(process.env.PEERLENS_ICE_MAX_AGE_SECONDS || '1200', 10) || 1200;
export const ICE_MAX_CANDIDATES_PER_ROLE =
	Number.parseInt(process.env.PEERLENS_ICE_MAX_CANDIDATES_PER_ROLE || '64', 10) || 64;

const configuredDatabaseUrl = (process.env.PEERLENS_DB_URL || '').trim();
const configuredDatabaseAuthToken =
	(process.env.PEERLENS_DB_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || '').trim();
const configuredPath = (process.env.PEERLENS_DB_PATH || '').trim();
const dbFilePath = resolve(configuredPath || '.data/peerlens.sqlite');
const databaseUrl = configuredDatabaseUrl || `file:${dbFilePath}`;
const usesLocalFileDatabase = databaseUrl.startsWith('file:');

if (!configuredDatabaseUrl) {
	mkdirSync(dirname(dbFilePath), { recursive: true });
}

export const signalingClient = createClient(
	configuredDatabaseAuthToken
		? { url: databaseUrl, authToken: configuredDatabaseAuthToken }
		: { url: databaseUrl }
);

let initialized: Promise<void> | null = null;
let nextCleanupAtMs = 0;

function isDuplicateColumnError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return message.includes('duplicate column name') || message.includes('already exists');
}

async function addColumnIfMissing(sql: string): Promise<void> {
	try {
		await signalingClient.execute(sql);
	} catch (error) {
		if (!isDuplicateColumnError(error)) {
			throw error;
		}
	}
}

export function asString(value: InValue): string | null {
	if (typeof value === 'string') {
		return value;
	}

	return null;
}

export function asNumber(value: InValue): number {
	if (typeof value === 'number') {
		return value;
	}

	if (typeof value === 'bigint') {
		return Number(value);
	}

	throw new Error('Unexpected non-numeric SQLite value');
}

export async function cleanupSignalingIfDue(force = false): Promise<void> {
	const now = Date.now();
	if (!force && now < nextCleanupAtMs) {
		return;
	}

	nextCleanupAtMs = now + CLEANUP_INTERVAL_SECONDS * 1000;

	await signalingClient.execute({
		sql: `
			DELETE FROM sessions
			WHERE expires_at IS NOT NULL AND expires_at <= unixepoch()
		`
	});

	await signalingClient.execute({
		sql: `
			DELETE FROM sessions
			WHERE connected_at IS NULL
			  AND answer_sdp IS NULL
			  AND created_at <= unixepoch() - ?
		`,
		args: [UNCONNECTED_SESSION_TTL_SECONDS]
	});

	await signalingClient.execute({
		sql: `
			DELETE FROM sessions
			WHERE (connected_at IS NOT NULL OR answer_sdp IS NOT NULL)
			  AND COALESCE(connected_at, updated_at) <= unixepoch() - ?
		`,
		args: [CONNECTED_SESSION_TTL_SECONDS]
	});

	await signalingClient.execute({
		sql: `DELETE FROM ice_candidates WHERE created_at <= unixepoch() - ?`,
		args: [ICE_MAX_AGE_SECONDS]
	});

	await signalingClient.execute({
		sql: `
			DELETE FROM sessions
			WHERE offer_sdp IS NULL
			  AND created_at <= unixepoch() - ?
		`,
		args: [OFFER_TTL_SECONDS]
	});
}

export async function ensureSignalingInitialized(): Promise<void> {
	initialized ??= (async () => {
		if (usesLocalFileDatabase) {
			await signalingClient.execute('PRAGMA journal_mode = WAL;');
			await signalingClient.execute('PRAGMA foreign_keys = ON;');
		}

		await signalingClient.execute(`
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

		await addColumnIfMissing(`ALTER TABLE sessions ADD COLUMN expires_at INTEGER`);
		await addColumnIfMissing(`ALTER TABLE sessions ADD COLUMN connected_at INTEGER`);
		await addColumnIfMissing(
			`ALTER TABLE sessions ADD COLUMN viewer_state TEXT CHECK(viewer_state IN ('offered', 'waiting', 'party', 'left'))`
		);
		await addColumnIfMissing(
			`ALTER TABLE sessions ADD COLUMN phone_state TEXT CHECK(phone_state IN ('offered', 'waiting', 'party', 'left'))`
		);
		await addColumnIfMissing(`ALTER TABLE sessions ADD COLUMN state_version INTEGER NOT NULL DEFAULT 0`);
		await addColumnIfMissing(`ALTER TABLE sessions ADD COLUMN viewer_state_at INTEGER`);
		await addColumnIfMissing(`ALTER TABLE sessions ADD COLUMN phone_state_at INTEGER`);

		await signalingClient.execute(`UPDATE sessions SET state_version = 0 WHERE state_version IS NULL`);

		await signalingClient.execute(`
			CREATE TABLE IF NOT EXISTS ice_candidates (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_id TEXT NOT NULL,
				role TEXT NOT NULL CHECK(role IN ('viewer', 'phone')),
				candidate_json TEXT NOT NULL,
				created_at INTEGER NOT NULL DEFAULT (unixepoch()),
				FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
			);
		`);

		await signalingClient.execute(`
			CREATE INDEX IF NOT EXISTS idx_ice_candidates_session_id_id
			ON ice_candidates(session_id, id);
		`);

		await signalingClient.execute(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_ice_candidates_unique
			ON ice_candidates(session_id, role, candidate_json);
		`);

		await signalingClient.execute(`
			CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
			ON sessions(expires_at);
		`);

		await cleanupSignalingIfDue(true);
	})();

	await initialized;
}
