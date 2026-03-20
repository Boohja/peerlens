import {
	ICE_MAX_CANDIDATES_PER_ROLE,
	asNumber,
	asString,
	cleanupSignalingIfDue,
	ensureSignalingInitialized,
	signalingClient
} from './signaling-db';
import { getSession } from './session-store';
import type { PeerRole, StoredIceCandidate } from './signaling-types';

export async function addIceCandidate(
	sessionId: string,
	role: PeerRole,
	candidate: unknown
): Promise<number> {
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();

	const session = await getSession(sessionId);
	if (!session?.offer) {
		throw new Error('Session not found');
	}

	if (session.connectedAt != null) {
		return 0;
	}

	const candidateJson = JSON.stringify(candidate);

	const result = await signalingClient.execute({
		sql: `INSERT OR IGNORE INTO ice_candidates(session_id, role, candidate_json) VALUES (?, ?, ?)`,
		args: [sessionId, role, candidateJson]
	});

	await signalingClient.execute({
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
		const existing = await signalingClient.execute({
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
	await ensureSignalingInitialized();
	await cleanupSignalingIfDue();

	const session = await getSession(sessionId);
	if (!session?.offer) {
		return [];
	}

	if (session.connectedAt != null) {
		return [];
	}

	const result = await signalingClient.execute({
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
