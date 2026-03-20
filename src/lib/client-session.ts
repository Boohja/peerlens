import {
	appendSessionIdentityLog,
	clearSessionIdentity,
	clearSessionIdentityForSession,
	getSessionIdentity,
	setSessionIdentity
} from '$lib/session-identity';
import {
	patchSessionRoleState,
	type ClientSessionPartyState,
	type ClientSessionRole
} from '$lib/session-state';

type RecoverableSessionPayload = {
	sessionId?: unknown;
	viewerState?: unknown;
	phoneState?: unknown;
	connectedAt?: unknown;
	updatedAt?: unknown;
};

export type RecoveredSession = {
	sessionId: string;
	viewerState: ClientSessionPartyState | null;
	phoneState: ClientSessionPartyState | null;
	connectedAt: number | null;
	updatedAt: number | null;
};

export type SessionRecoveryResult =
	| { ok: true; session: RecoveredSession }
	| {
			ok: false;
			reason: 'missing' | 'not-found' | 'viewer-left' | 'request-failed';
			sessionId?: string;
			status?: number;
	  };

function getStoredSessionId(): string {
	return getSessionIdentity()?.sessionId ?? '';
}

function asPartyState(value: unknown): ClientSessionPartyState | null {
	return value === 'offered' || value === 'waiting' || value === 'party' || value === 'left'
		? value
		: null;
}

function asNullableNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function tryRecoverSession(): Promise<SessionRecoveryResult> {
	const sessionId = getStoredSessionId();
	if (!sessionId) {
		return { ok: false, reason: 'missing' };
	}

	try {
		const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
		if (response.status === 404) {
			clearSessionIdentityForSession(sessionId);
			return { ok: false, reason: 'not-found', sessionId, status: 404 };
		}

		if (!response.ok) {
			return { ok: false, reason: 'request-failed', sessionId, status: response.status };
		}

		const payload = (await response.json()) as RecoverableSessionPayload;
		const viewerState = asPartyState(payload.viewerState);
		if (viewerState === 'left') {
			clearSessionIdentityForSession(sessionId);
			return { ok: false, reason: 'viewer-left', sessionId };
		}

		return {
			ok: true,
			session: {
				sessionId,
				viewerState,
				phoneState: asPartyState(payload.phoneState),
				connectedAt: asNullableNumber(payload.connectedAt),
				updatedAt: asNullableNumber(payload.updatedAt)
			}
		};
	} catch {
		return { ok: false, reason: 'request-failed', sessionId };
	}
}

export class ClientSession {
	private readonly role: ClientSessionRole;

	constructor(role: ClientSessionRole) {
		this.role = role;
	}

	getSessionId(): string {
		return getStoredSessionId();
	}

	setSessionId(sessionId: string): void {
		if (!sessionId) return;
		setSessionIdentity(sessionId);
	}

	clear(sessionId?: string): void {
		if (sessionId) {
			clearSessionIdentityForSession(sessionId);
			return;
		}

		clearSessionIdentity();
	}

	log(message: string): void {
		appendSessionIdentityLog(message);
	}

	async setState(nextState: ClientSessionPartyState, sessionId?: string): Promise<void> {
		const activeSessionId = this.getSessionId();
		if (sessionId && sessionId !== activeSessionId) {
			return;
		}

		const targetSessionId = activeSessionId;
		if (!targetSessionId) return;

		this.log(`PATCH ${this.role}_state -> ${nextState}`);
		await patchSessionRoleState(targetSessionId, this.role, nextState);
	}

	async destroy(sessionId?: string): Promise<void> {
		const activeSessionId = this.getSessionId();
		if (sessionId && activeSessionId && sessionId !== activeSessionId) {
			return;
		}

		const targetSessionId = sessionId || activeSessionId;
		if (!targetSessionId) {
			this.clear();
			return;
		}

		try {
			this.log(`DELETE /api/sessions/${targetSessionId}`);
			await fetch(`/api/sessions/${encodeURIComponent(targetSessionId)}`, { method: 'DELETE' });
		} catch {
			// ignore best-effort cleanup failures
		}

		this.clear(targetSessionId);
	}
}
