const PUBLIC_APP_HOST = (import.meta.env.PUBLIC_APP_HOST as string | undefined) || '';

function normalizeOrigin(value: string): string | null {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

export function resolvePublicHost(fallbackOrigin: string): string {
	const configuredOrigin = normalizeOrigin((PUBLIC_APP_HOST || '').trim());
	return configuredOrigin || fallbackOrigin;
}

export function buildPhoneJoinUrl(sessionId: string, fallbackOrigin: string): string {
	const url = new URL('/phone', resolvePublicHost(fallbackOrigin));
	url.searchParams.set('session', sessionId);
	return url.toString();
}

export function isPublicHostConfigured(): boolean {
	return Boolean(normalizeOrigin((PUBLIC_APP_HOST || '').trim()));
}
