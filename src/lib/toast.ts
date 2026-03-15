import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'warning' | 'error';

export type Toast = {
	id: number;
	text: string;
	variant: ToastVariant;
	durationMs: number;
};

type ToastOptions = {
	durationMs?: number;
};

const DEFAULT_DURATION_MS = 6000;

const store = writable<Toast[]>([]);
const timeoutById = new Map<number, ReturnType<typeof setTimeout>>();
let nextToastId = 1;

export const toasts = {
	subscribe: store.subscribe
};

export function showToast(
	variant: ToastVariant,
	text: string,
	options: ToastOptions = {}
): number {
	const id = nextToastId++;
	const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
	const toast: Toast = { id, text, variant, durationMs };

	store.update((current) => [...current, toast]);

	const timeout = setTimeout(() => {
		dismissToast(id);
	}, durationMs);
	timeoutById.set(id, timeout);

	return id;
}

export function toast(variant: ToastVariant, text: string, options: ToastOptions = {}) {
	return showToast(variant, text, options);
}

export function dismissToast(id: number) {
	const timeout = timeoutById.get(id);
	if (timeout) {
		clearTimeout(timeout);
		timeoutById.delete(id);
	}

	store.update((current) => current.filter((toast) => toast.id !== id));
}

export function clearToasts() {
	for (const timeout of timeoutById.values()) {
		clearTimeout(timeout);
	}
	timeoutById.clear();
	store.set([]);
}
