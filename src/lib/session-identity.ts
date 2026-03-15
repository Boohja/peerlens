import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type SessionIdentity = {
	sessionId: string;
	shorthand: string;
	log: SessionIdentityLogEntry[];
};

export type SessionIdentityLogEntry = {
	datetime: string;
	message: string;
};

const STORAGE_KEY = 'peerlens-session-identity-v1';
const SHORTHAND_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hashSessionId(value: string) {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.codePointAt(index) ?? 0;
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

export function createSessionShorthand(sessionId: string, length = 5) {
	if (!sessionId) return '';

	const maxLength = Math.max(4, Math.min(5, length));
	let hash = hashSessionId(sessionId);
	let shorthand = '';

	for (let index = 0; index < maxLength; index += 1) {
		shorthand += SHORTHAND_CHARS[hash % SHORTHAND_CHARS.length];
		hash = Math.floor(hash / SHORTHAND_CHARS.length);

		if (hash === 0 && index < maxLength - 1) {
			hash = hashSessionId(`${sessionId}:${index}`);
		}
	}

	return shorthand;
}

function readStoredIdentity(): SessionIdentity | null {
	if (!browser) return null;

	try {
		const raw = globalThis.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as {
			sessionId?: unknown;
			shorthand?: unknown;
			log?: unknown;
		};
		if (typeof parsed.sessionId !== 'string' || !parsed.sessionId) return null;

		const shorthand =
			typeof parsed.shorthand === 'string' && parsed.shorthand
				? parsed.shorthand
				: createSessionShorthand(parsed.sessionId);

		const log = Array.isArray(parsed.log)
			? parsed.log
					.filter(
						(entry): entry is SessionIdentityLogEntry =>
							typeof entry === 'object' &&
							entry !== null &&
							typeof (entry as { datetime?: unknown }).datetime === 'string' &&
							typeof (entry as { message?: unknown }).message === 'string'
					)
					.map((entry) => ({ datetime: entry.datetime, message: entry.message }))
			: [];

		return { sessionId: parsed.sessionId, shorthand, log };
	} catch {
		return null;
	}
}

const store = writable<SessionIdentity | null>(readStoredIdentity());

if (browser) {
	store.subscribe((value) => {
		if (value) {
			globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
			return;
		}

		globalThis.localStorage.removeItem(STORAGE_KEY);
	});
}

export const sessionIdentity = {
	subscribe: store.subscribe
};

export function getSessionIdentity(): SessionIdentity | null {
	return readStoredIdentity();
}

export function setSessionIdentity(sessionId: string) {
	if (!sessionId) return;

	store.update((current) => {
		if (current?.sessionId === sessionId) {
			return current;
		}

		return {
			sessionId,
			shorthand: createSessionShorthand(sessionId),
			log: []
		};
	});
}

export function appendSessionIdentityLog(message: string) {
	if (!message.trim()) return;

	store.update((current) => {
		if (!current) return current;

		const nextLog = [
			...current.log,
			{ datetime: new Date().toLocaleString(), message: message.trim() }
		];

		return {
			...current,
			log: nextLog
		};
	});
}

export function clearSessionIdentity() {
	store.set(null);
}

export function clearSessionIdentityForSession(sessionId: string) {
	if (!sessionId) return;

	store.update((current) => (current?.sessionId === sessionId ? null : current));
}
