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

export class ViewerRtcManager {
	private peer: RTCPeerConnection | null = null;
	private answerPollTimer: ReturnType<typeof setInterval> | null = null;
	private icePollTimer: ReturnType<typeof setInterval> | null = null;
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
			clearInterval(this.answerPollTimer);
			this.answerPollTimer = null;
		}

		if (this.icePollTimer) {
			clearInterval(this.icePollTimer);
			this.icePollTimer = null;
		}
	}

	private async pollAnswer(id: string): Promise<void> {
		if (!this.peer) return;

		const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/description`);
		if (response.status === 404) {
			this.options.onStatusChange('Session expired. Create a new session.');
			this.options.onBlurCodeChange(true);
			this.options.onStepChange('qr');
			this.options.session.log('pollAnswer: session not found (404)');
			this.options.session.clear(id);
			this.options.onSessionInvalidated();
			this.stop();
			return;
		}

		if (!response.ok) return;

		const payload = (await response.json()) as {
			answer: { type: 'answer'; sdp: string } | null;
		};

		if (!payload.answer || !this.peer || this.peer.currentRemoteDescription) {
			return;
		}

		await this.peer.setRemoteDescription({ type: payload.answer.type, sdp: payload.answer.sdp });
		await this.flushPendingRemoteIce();
		this.options.session.log('answer received and set as remote description');
		this.options.onStatusChange('Answer received. Establishing stream...');
	}

	private async pollIce(id: string): Promise<void> {
		if (!this.peer) return;

		const response = await fetchIceCandidatesForViewer(id, this.lastIceId, 100);
		if (response.status === 404) {
			this.options.onStatusChange('Session expired. Create a new session.');
			this.options.onBlurCodeChange(true);
			this.options.onStepChange('qr');
			this.options.session.log('pollIce: session not found (404)');
			this.options.session.clear(id);
			this.options.onSessionInvalidated();
			this.stop();
			return;
		}

		if (!response.ok) return;

		const payload = (await response.json()) as {
			candidates: Array<{ candidate: RTCIceCandidateInit | null }>;
			nextAfter: number;
		};

		for (const item of payload.candidates) {
			if (!item.candidate || !this.peer) continue;

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
	}

	private startPolling(id: string): void {
		this.clearTimers();

		this.answerPollTimer = setInterval(() => {
			void this.pollAnswer(id);
		}, 1200);

		this.icePollTimer = setInterval(() => {
			void this.pollIce(id);
		}, 800);
	}
}