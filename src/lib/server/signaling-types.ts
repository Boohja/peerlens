export type PeerRole = 'viewer' | 'phone';
export type SessionDescriptionType = 'offer' | 'answer';
export type SessionRole = 'viewer' | 'phone';
export type SessionPartyState = 'offered' | 'waiting' | 'party' | 'left';

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

export interface StoredSession {
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
}

export interface SessionStateSnapshot {
	viewerState: SessionPartyState | null;
	phoneState: SessionPartyState | null;
	stateVersion: number;
	viewerStateAt: number | null;
	phoneStateAt: number | null;
}
