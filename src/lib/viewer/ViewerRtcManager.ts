import type { ClientSession } from '$lib/client-session';
import {
	postDescription,
	postViewerIceCandidate,
	fetchIceCandidatesForViewer,
	markSessionAsConnected
} from '$lib/webrtc/signaling-client';

type ViewerRtcManagerOptions = {
	session: ClientSession;
	getSessionId: () => string;
	onStatusChange: (status: string) => void;
	onStepChange: (step: 'qr' | 'stream') => void;
	onBlurCodeChange: (blur: boolean) => void;
	onRemoteStreamChange: (stream: MediaStream | null) => void;
	onSessionInvalidated: () => void;
};

function parsePollMs(raw: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(raw || '', 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

const ANSWER_POLL_MIN_MS = parsePollMs(import.meta.env.PUBLIC_PEERLENS_VIEWER_ANSWER_POLL_MIN_MS, 1200);
const ANSWER_POLL_MAX_MS = Math.max(
	ANSWER_POLL_MIN_MS,
	parsePollMs(import.meta.env.PUBLIC_PEERLENS_VIEWER_ANSWER_POLL_MAX_MS, 8000)
);
const ICE_POLL_MIN_MS = parsePollMs(import.meta.env.PUBLIC_PEERLENS_VIEWER_ICE_POLL_MIN_MS, 800);
const ICE_POLL_MAX_MS = Math.max(
	ICE_POLL_MIN_MS,
	parsePollMs(import.meta.env.PUBLIC_PEERLENS_VIEWER_ICE_POLL_MAX_MS, 5000)
);

export class ViewerRtcManager {
	private peer: RTCPeerConnection | null = null;
	private answerPollTimer: ReturnType<typeof setTimeout> | null = null;
	private icePollTimer: ReturnType<typeof setTimeout> | null = null;
	private answerPollDelayMs = ANSWER_POLL_MIN_MS;
	private icePollDelayMs = ICE_POLL_MIN_MS;
	private answerPollInFlight = false;
	private icePollInFlight = false;
	private lastIceId = 0;
	private pendingRemoteIce: RTCIceCandidateInit[] = [];
	private remoteStream: MediaStream | null = null;

	constructor(private readonly options: ViewerRtcManagerOptions) {}

	stop(): void {
		this.clearTimers();
		this.pendingRemoteIce = [];

		if (this.peer) {
			this.peer.onicecandidate = null;
			this.peer.ontrack = null;
			this.peer.onconnectionstatechange = null;
			this.peer.close();
			this.peer = null;
		}

		this.lastIceId = 0;
		this.answerPollDelayMs = ANSWER_POLL_MIN_MS;
		this.icePollDelayMs = ICE_POLL_MIN_MS;
		this.answerPollInFlight = false;
		this.icePollInFlight = false;
		this.remoteStream = null;
		this.options.onRemoteStreamChange(null);
	}

	async start(id: string): Promise<void> {
		this.stop();
		this.peer = new RTCPeerConnection({ iceServers: [] });

		this.peer.addTransceiver('video', { direction: 'recvonly' });

		this.peer.ontrack = (event) => {
			const [streamFromEvent] = event.streams;
			this.options.session.log(
				`ontrack: kind=${event.track.kind}, readyState=${event.track.readyState}, streams=${event.streams.length}`
			);

			if (streamFromEvent) {
				this.remoteStream = streamFromEvent;
				this.options.onRemoteStreamChange(streamFromEvent);
				return;
			}

			if (!this.remoteStream) {
				this.remoteStream = new MediaStream();
			}

			this.remoteStream.addTrack(event.track);
			this.options.onRemoteStreamChange(this.remoteStream);
		};

		this.peer.onicecandidate = (event) => {
			if (!event.candidate) return;
			postViewerIceCandidate(id, event.candidate).catch((err) => {
				console.error('Failed to publish viewer ICE candidate:', err);
				this.options.session.log(`postIceCandidate failed: ${String(err)}`);
			});
		};

		this.peer.onconnectionstatechange = () => {
			if (!this.peer) return;

			if (this.peer.connectionState === 'connected') {
				this.clearTimers();
				this.options.onStepChange('stream');
				this.options.onStatusChange('Connected');
				this.options.session.log('peer connected');
				this.options.session.setState('party', id).catch(console.error);
				this.options.session.log('POST connected');
				markSessionAsConnected(id).catch((err) => {
					console.error('Failed to mark session as connected:', err);
					this.options.session.log(`POST connected failed: ${String(err)}`);
				});
			} else if (
				this.peer.connectionState === 'failed' ||
				this.peer.connectionState === 'disconnected'
			) {
				this.options.onStepChange('qr');
				this.options.onStatusChange('Disconnected');
				this.options.session.log(
					this.peer.connectionState === 'failed' ? 'peer failed' : 'peer disconnected'
				);
				this.stop();
				const sessionId = this.options.getSessionId();
				if (sessionId) {
					void this.start(sessionId).catch(console.error);
				}
			}
		};

		const offer = await this.peer.createOffer();
		await this.peer.setLocalDescription(offer);

		if (!this.peer.localDescription?.sdp) {
			throw new Error('Missing local offer SDP');
		}

		await postDescription(id, 'offer', this.peer.localDescription.sdp);
		this.options.session.setState('offered', id).catch(console.error);
		this.options.onStepChange('qr');
		this.options.onStatusChange('Waiting for phone to scan code...');
		this.startPolling(id);
	}

	private async flushPendingRemoteIce(): Promise<void> {
		if (!this.peer?.currentRemoteDescription || this.pendingRemoteIce.length === 0) {
			return;
		}

		const queued = this.pendingRemoteIce;
		this.pendingRemoteIce = [];

		for (const candidate of queued) {
			try {
				await this.peer.addIceCandidate(candidate);
			} catch (err) {
				console.error('Failed to add queued ICE candidate:', err);
			}
		}
	}

	private clearTimers(): void {
		if (this.answerPollTimer) {
			clearTimeout(this.answerPollTimer);
			this.answerPollTimer = null;
		}

		if (this.icePollTimer) {
			clearTimeout(this.icePollTimer);
			this.icePollTimer = null;
		}
	}

	private async pollAnswer(id: string): Promise<boolean> {
		if (!this.peer) return false;

		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`);
		if (response.status === 404) {
			this.options.onStatusChange('Session expired. Create a new session.');
			this.options.onBlurCodeChange(true);
			this.options.onStepChange('qr');
			this.options.session.log('pollAnswer: session not found (404)');
			this.options.session.clear(id);
			this.options.onSessionInvalidated();
			this.stop();
			return false;
		}

		if (!response.ok) return false;

		const payload = (await response.json()) as {
			answer: { type: 'answer'; sdp: string } | null;
		};

		if (!payload.answer || !this.peer || this.peer.currentRemoteDescription) {
			return false;
		}

		await this.peer.setRemoteDescription({ type: payload.answer.type, sdp: payload.answer.sdp });
		await this.flushPendingRemoteIce();
		this.options.session.log('answer received and set as remote description');
		this.options.onStatusChange('Answer received. Establishing stream...');
		return true;
	}

	private async pollIce(id: string): Promise<number> {
		if (!this.peer) return 0;

		const response = await fetchIceCandidatesForViewer(id, this.lastIceId, 100);
		if (response.status === 404) {
			this.options.onStatusChange('Session expired. Create a new session.');
			this.options.onBlurCodeChange(true);
			this.options.onStepChange('qr');
			this.options.session.log('pollIce: session not found (404)');
			this.options.session.clear(id);
			this.options.onSessionInvalidated();
			this.stop();
			return 0;
		}

		if (!response.ok) return 0;

		const payload = (await response.json()) as {
			candidates: Array<{ candidate: RTCIceCandidateInit | null }>;
			nextAfter: number;
		};

		let candidateCount = 0;

		for (const item of payload.candidates) {
			if (!item.candidate || !this.peer) continue;
			candidateCount += 1;

			if (!this.peer.currentRemoteDescription) {
				this.pendingRemoteIce.push(item.candidate);
				continue;
			}

			try {
				await this.peer.addIceCandidate(item.candidate);
			} catch (err) {
				console.error('Failed to add ICE candidate:', err);
			}
		}

		await this.flushPendingRemoteIce();
		this.lastIceId = payload.nextAfter;
		return candidateCount;
	}

	private startPolling(id: string): void {
		this.clearTimers();
		this.answerPollDelayMs = ANSWER_POLL_MIN_MS;
		this.icePollDelayMs = ICE_POLL_MIN_MS;
		this.scheduleAnswerPoll(id, 0);
		this.scheduleIcePoll(id, 0);
	}

	private scheduleAnswerPoll(id: string, delayMs: number): void {
		if (this.answerPollTimer) {
			clearTimeout(this.answerPollTimer);
		}

		this.answerPollTimer = setTimeout(() => {
			void this.runAnswerPoll(id);
		}, delayMs);
	}

	private scheduleIcePoll(id: string, delayMs: number): void {
		if (this.icePollTimer) {
			clearTimeout(this.icePollTimer);
		}

		this.icePollTimer = setTimeout(() => {
			void this.runIcePoll(id);
		}, delayMs);
	}

	private canContinueIcePolling(): boolean {
		if (!this.peer) {
			return false;
		}

		return this.peer.connectionState !== 'connected';
	}

	private async runAnswerPoll(id: string): Promise<void> {
		this.answerPollTimer = null;
		if (!this.peer || this.peer.currentRemoteDescription || this.answerPollInFlight) {
			return;
		}

		this.answerPollInFlight = true;
		try {
			const receivedAnswer = await this.pollAnswer(id);
			if (!this.peer || this.peer.currentRemoteDescription || receivedAnswer) {
				return;
			}

			this.answerPollDelayMs = Math.min(
				ANSWER_POLL_MAX_MS,
				Math.round(this.answerPollDelayMs * 1.5)
			);
			this.scheduleAnswerPoll(id, this.answerPollDelayMs);
		} catch (err) {
			this.options.session.log(`pollAnswer failed: ${String(err)}`);
			if (!this.peer || this.peer.currentRemoteDescription) {
				return;
			}

			this.answerPollDelayMs = Math.min(ANSWER_POLL_MAX_MS, this.answerPollDelayMs * 2);
			this.scheduleAnswerPoll(id, this.answerPollDelayMs);
		} finally {
			this.answerPollInFlight = false;
		}
	}

	private async runIcePoll(id: string): Promise<void> {
		this.icePollTimer = null;
		if (!this.canContinueIcePolling() || this.icePollInFlight) {
			return;
		}

		this.icePollInFlight = true;
		try {
			const receivedCandidates = await this.pollIce(id);
			if (!this.canContinueIcePolling()) {
				return;
			}

			if (receivedCandidates > 0) {
				this.icePollDelayMs = ICE_POLL_MIN_MS;
			} else {
				this.icePollDelayMs = Math.min(ICE_POLL_MAX_MS, Math.round(this.icePollDelayMs * 1.5));
			}

			this.scheduleIcePoll(id, this.icePollDelayMs);
		} catch (err) {
			this.options.session.log(`pollIce failed: ${String(err)}`);
			if (!this.canContinueIcePolling()) {
				return;
			}

			this.icePollDelayMs = Math.min(ICE_POLL_MAX_MS, this.icePollDelayMs * 2);
			this.scheduleIcePoll(id, this.icePollDelayMs);
		} finally {
			this.icePollInFlight = false;
		}
	}
}