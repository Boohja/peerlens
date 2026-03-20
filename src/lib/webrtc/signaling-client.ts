export type SignalingRole = 'viewer' | 'phone';

function buildIcePollUrl(id: string, recipientRole: SignalingRole, after: number, limit: number): string {
	const params = new URLSearchParams({
		for: recipientRole,
		after: String(after),
		limit: String(limit)
	});

	return `/api/sessions/${encodeURIComponent(id)}/ice?${params.toString()}`;
}

export async function createApiError(response: Response, fallbackMessage: string): Promise<Error> {
	let message = fallbackMessage;

	try {
		const payload = (await response.json()) as { message?: unknown; retryAfterSeconds?: unknown };
		if (typeof payload.message === 'string' && payload.message.trim()) {
			message = payload.message.trim();
		}

		if (response.status === 429 && typeof payload.retryAfterSeconds === 'number') {
			const seconds = Math.max(1, Math.floor(payload.retryAfterSeconds));
			message = `${message} Retry in ${seconds}s.`;
		}
	} catch {
		if (response.status === 429) {
			message = 'Too many requests. Please wait a moment and try again.';
		}
	}

	return new Error(message);
}

export function stripIceCandidatesFromSdp(sdp: string): string {
	return sdp
		.replaceAll(/^a=candidate:.*(?:\r?\n)?/gm, '')
		.replaceAll(/^a=end-of-candidates(?:\r?\n)?/gm, '');
}

export async function postDescription(id: string, type: 'offer' | 'answer', sdp: string): Promise<void> {
	const sanitizedSdp = stripIceCandidatesFromSdp(sdp);
	const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ type, sdp: sanitizedSdp })
	});

	if (!response.ok) {
		throw await createApiError(response, 'Could not publish session description');
	}
}

async function postRoleIceCandidate(id: string, role: SignalingRole, candidate: RTCIceCandidate) {
	const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/ice`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			role,
			candidate: {
				candidate: candidate.candidate,
				sdpMid: candidate.sdpMid,
				sdpMLineIndex: candidate.sdpMLineIndex,
				usernameFragment: candidate.usernameFragment
			}
		})
	});

	if (!response.ok) {
		throw await createApiError(response, 'Could not publish ICE candidate');
	}
}

export function postViewerIceCandidate(id: string, candidate: RTCIceCandidate): Promise<void> {
	return postRoleIceCandidate(id, 'viewer', candidate);
}

export function postPhoneIceCandidate(id: string, candidate: RTCIceCandidate): Promise<void> {
	return postRoleIceCandidate(id, 'phone', candidate);
}

export function fetchIceCandidatesForViewer(id: string, after: number, limit = 100): Promise<Response> {
	return fetch(buildIcePollUrl(id, 'viewer', after, limit));
}

export function fetchIceCandidatesForPhone(id: string, after: number, limit = 100): Promise<Response> {
	return fetch(buildIcePollUrl(id, 'phone', after, limit));
}

export async function markSessionAsConnected(id: string): Promise<void> {
	const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/connected`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' }
	});

	if (!response.ok) {
		throw await createApiError(response, 'Could not mark session as connected');
	}
}
