import type { ClientSession } from '$lib/client-session';
import {
	createApiError,
	postDescription,
	postPhoneIceCandidate,
	fetchIceCandidatesForPhone,
	markSessionAsConnected
} from '$lib/webrtc/signaling-client';

type PhoneRtcManagerOptions = {
	session: ClientSession;
	getSessionId: () => string;
	onStatusChange: (status: string) => void;
	onErrorChange: (message: string) => void;
	onShowIpv6FallbackChange: (show: boolean) => void;
	onConnected: () => void;
	onPeerDisconnected: () => void;
};

function isRateLimitError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return /too many requests|retry in/i.test(error.message);
}

function extractCandidateAddress(candidateLine: string): string | null {
	const parts = candidateLine.trim().split(/\s+/);
	if (parts.length < 6) return null;
	return parts[4] ?? null;
}

function isPrivateIpv4Address(address: string): boolean {
	const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
	if (!match) return false;

	const octets = match.slice(1).map(Number);
	if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;

	const [first, second] = octets;
	if (first === 10) return true;
	if (first === 192 && second === 168) return true;
	if (first === 172 && second >= 16 && second <= 31) return true;
	if (first === 169 && second === 254) return true;

	return false;
}

function isLocalAddress(address: string): boolean {
	const normalized = address.toLowerCase();

	if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.local')) {
		return true;
	}

	if (isPrivateIpv4Address(normalized)) {
		return true;
	}

	if (normalized.includes(':')) {
		if (normalized.startsWith('fe80:')) return true;
		if (/^f[c-d][0-9a-f]{0,2}:/i.test(normalized)) return true;
	}

	return false;
}

function isPublicIpv6Address(address: string): boolean {
	const normalized = address.toLowerCase();
	if (!normalized.includes(':')) return false;
	if (isLocalAddress(normalized)) return false;
	return /^[23][0-9a-f]{0,3}:/i.test(normalized);
}

export class PhoneRtcManager {
	private peer: RTCPeerConnection | null = null;
	private icePollTimer: ReturnType<typeof setInterval> | null = null;
	private lastIceId = 0;
	private gatheredLocalCandidates: RTCIceCandidate[] = [];
	private rejectedPublicIpv6Candidates: RTCIceCandidate[] = [];
	private publicIpv6PromptHandled = false;

	constructor(private readonly options: PhoneRtcManagerOptions) {}

	getConnectionState(): RTCPeerConnectionState | null {
		return this.peer?.connectionState ?? null;
	}

	stop(): void {
		this.clearSignalingTimer();
		this.gatheredLocalCandidates = [];
		this.rejectedPublicIpv6Candidates = [];
		this.publicIpv6PromptHandled = false;
		this.options.onShowIpv6FallbackChange(false);

		if (!this.peer) {
			this.lastIceId = 0;
			return;
		}

		this.peer.onicecandidate = null;
		this.peer.onconnectionstatechange = null;
		this.peer.close();
		this.peer = null;
		this.lastIceId = 0;
	}

	async replaceVideoTrack(nextTrack: MediaStreamTrack, nextStream: MediaStream): Promise<void> {
		if (!this.peer) {
			return;
		}

		const videoSender = this.peer.getSenders().find((sender) => sender.track?.kind === 'video');
		if (videoSender) {
			await videoSender.replaceTrack(nextTrack);
			return;
		}

		this.peer.addTrack(nextTrack, nextStream);
	}

	async start(mediaStream: MediaStream): Promise<void> {
		const sessionId = this.options.getSessionId();
		if (!sessionId) {
			return;
		}

		this.stop();
		this.options.onShowIpv6FallbackChange(false);
		this.options.onStatusChange('Waiting for viewer offer...');
		this.options.session.log('start signaling');

		const { sdp: offerSdp } = await this.waitForOffer(sessionId);
		this.peer = new RTCPeerConnection({ iceServers: [] });
		this.lastIceId = 0;

		for (const track of mediaStream.getTracks()) {
			this.peer.addTrack(track, mediaStream);
		}

		this.peer.onicecandidate = (event) => {
			if (!event.candidate) {
				if (this.publicIpv6PromptHandled) return;

				if (this.gatheredLocalCandidates.length > 0) {
					void this.publishAnswerAndCandidates(this.gatheredLocalCandidates);
				} else if (this.rejectedPublicIpv6Candidates.length > 0) {
					this.publicIpv6PromptHandled = true;
					this.options.onStatusChange('Public IPv6 found. Waiting for your decision...');
					this.options.onShowIpv6FallbackChange(true);
				} else {
					this.options.onStatusChange('No local address found.');
					this.options.onErrorChange(
						'Could not find any local network address to use for the connection.'
					);
				}

				return;
			}

			const address = extractCandidateAddress(event.candidate.candidate);
			if (!address) {
				this.options.session.log('rejected ICE candidate: unable to parse address');
				return;
			}

			if (isLocalAddress(address)) {
				this.gatheredLocalCandidates.push(event.candidate);
				return;
			}

			if (isPublicIpv6Address(address)) {
				this.rejectedPublicIpv6Candidates.push(event.candidate);
				this.options.session.log(`rejected public IPv6 ICE candidate (${address})`);
				return;
			}

			this.options.session.log(`rejected non-local ICE candidate (${address})`);
		};

		this.peer.onconnectionstatechange = () => {
			if (!this.peer) return;

			if (this.peer.connectionState === 'connected') {
				this.options.onStatusChange('Connected');
				this.clearSignalingTimer();
				this.options.session.log('peer connected');
				this.options.session.setState('party', sessionId).catch(console.error);
				this.options.session.log('POST connected');
				markSessionAsConnected(sessionId).catch((err) => {
					console.error('Failed to mark session as connected:', err);
					this.options.session.log(`POST connected failed: ${String(err)}`);
					if (err instanceof Error && isRateLimitError(err)) {
						this.options.onStatusChange(err.message);
					}
				});
				this.options.onConnected();
			} else if (
				this.peer.connectionState === 'failed' ||
				this.peer.connectionState === 'disconnected'
			) {
				this.options.session.log(
					this.peer.connectionState === 'failed'
						? 'peer failed; ending phone stream'
						: 'peer disconnected; ending phone stream'
				);
				this.options.onStatusChange('Disconnected');
				this.options.onPeerDisconnected();
			}
		};

		await this.peer.setRemoteDescription({ type: 'offer', sdp: offerSdp });
		const answer = await this.peer.createAnswer();
		await this.peer.setLocalDescription(answer);

		if (!this.peer.localDescription?.sdp) {
			throw new Error('Missing local answer SDP');
		}

		this.options.onStatusChange('Gathering local addresses...');
		this.options.session.log('local description set; gathering ICE candidates');
	}

	confirmIpv6FallbackCandidate(): void {
		const fallbackCandidate = this.rejectedPublicIpv6Candidates[0];
		if (!fallbackCandidate) {
			this.options.onShowIpv6FallbackChange(false);
			this.rejectIpv6FallbackCandidate();
			return;
		}

		this.options.session.log('user accepted public IPv6 fallback candidate');
		this.options.onStatusChange('Connecting (public IPv6 fallback approved)...');
		this.options.onShowIpv6FallbackChange(false);
		void this.publishAnswerAndCandidates([fallbackCandidate]);
	}

	rejectIpv6FallbackCandidate(): void {
		this.options.session.log('user rejected public IPv6 fallback candidate; stopping phone stream');
		this.options.onErrorChange(
			'Connection stopped because only public IPv6 was available and not approved.'
		);
		this.options.onStatusChange('Stopped');
		this.options.onShowIpv6FallbackChange(false);
	}

	private clearSignalingTimer(): void {
		if (this.icePollTimer) {
			clearInterval(this.icePollTimer);
			this.icePollTimer = null;
		}
	}

	private async publishAnswerAndCandidates(candidates: RTCIceCandidate[]): Promise<void> {
		const sessionId = this.options.getSessionId();
		if (!sessionId || !this.peer?.localDescription?.sdp) {
			this.options.session.log('publishAnswerAndCandidates: missing local SDP');
			return;
		}

		try {
			this.options.session.log('POST description answer');
			await postDescription(sessionId, 'answer', this.peer.localDescription.sdp);
		} catch (err) {
			console.error('Failed to post answer:', err);
			this.options.session.log(`postDescription failed: ${String(err)}`);
			this.options.onStatusChange(err instanceof Error ? err.message : 'Could not publish answer');
			return;
		}

		this.options.session.setState('waiting', sessionId).catch(console.error);
		this.options.session.log('answer published; waiting for connection');
		this.options.onStatusChange('Answer published. Connecting...');

		for (const candidate of candidates) {
			postPhoneIceCandidate(sessionId, candidate).catch((err) => {
				console.error('Failed to publish phone ICE candidate:', err);
				this.options.session.log(`postIceCandidate failed: ${String(err)}`);
				if (err instanceof Error && isRateLimitError(err)) {
					this.options.onStatusChange(err.message);
				}
			});
		}

		this.startIcePolling(sessionId);
	}

	private async fetchOffer(id: string): Promise<{ sdp: string } | null> {
		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`);

		if (response.status === 404) {
			throw new Error('Session expired or missing');
		}

		if (response.status === 429) {
			throw await createApiError(response, 'Too many requests while waiting for viewer offer');
		}

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as {
			offer: { type: 'offer'; sdp: string } | null;
		};

		const sdp = payload.offer?.sdp || null;
		if (!sdp) return null;
		return { sdp };
	}

	private async pollViewerIce(id: string): Promise<void> {
		if (!this.peer) return;

		const response = await fetchIceCandidatesForPhone(id, this.lastIceId, 100);
		if (response.status === 404) {
			this.options.onStatusChange('Session expired');
			this.options.session.log('pollViewerIce: session not found (404)');
			this.options.session.clear(id);
			this.stop();
			return;
		}

		if (response.status === 429) {
			const err = await createApiError(response, 'Too many requests while syncing ICE');
			this.options.onStatusChange(err.message);
			this.options.session.log(`pollViewerIce: rate limited (${err.message})`);
			return;
		}

		if (!response.ok) {
			return;
		}

		const payload = (await response.json()) as {
			candidates: Array<{ candidate: RTCIceCandidateInit | null }>;
			nextAfter: number;
		};

		for (const item of payload.candidates) {
			if (!item.candidate || !this.peer) continue;
			await this.peer.addIceCandidate(item.candidate);
		}

		this.lastIceId = payload.nextAfter;
	}

	private startIcePolling(id: string): void {
		this.clearSignalingTimer();
		this.icePollTimer = setInterval(() => {
			void this.pollViewerIce(id);
		}, 800);
	}

	private async waitForOffer(id: string, timeoutMs = 30000): Promise<{ sdp: string }> {
		const start = Date.now();

		while (Date.now() - start < timeoutMs) {
			const result = await this.fetchOffer(id);
			if (result) {
				return result;
			}

			await new Promise((resolve) => setTimeout(resolve, 700));
		}

		throw new Error('Timed out waiting for viewer offer');
	}
}