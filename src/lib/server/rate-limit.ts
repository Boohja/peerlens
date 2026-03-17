import { createHmac, randomBytes } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

type RateLimitBucket = {
	count: number;
	resetAt: number;
};

export interface RateLimitRule {
	bucket: string;
	windowMs: number;
	maxRequests: number;
}

export interface RateLimitResult {
	allowed: boolean;
	retryAfterSeconds: number;
}

const buckets = new Map<string, RateLimitBucket>();
const fallbackSecret = randomBytes(32).toString('hex');
const rateLimitSecret = (process.env.PEERLENS_RATE_LIMIT_SECRET || fallbackSecret).trim();

function getClientIp(event: RequestEvent): string {
	const forwardedFor = event.request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		const first = forwardedFor.split(',')[0]?.trim();
		if (first) return first;
	}

	const realIp = event.request.headers.get('x-real-ip')?.trim();
	if (realIp) {
		return realIp;
	}

	try {
		const address = event.getClientAddress?.();
		if (address) return address;
	} catch {
		// no-op fallback below
	}

	return 'unknown';
}

function hashClientIp(ip: string): string {
	return createHmac('sha256', rateLimitSecret).update(ip).digest('base64url');
}

function compactBuckets(now: number) {
	if (buckets.size < 2048) return;

	for (const [key, value] of buckets) {
		if (value.resetAt <= now) {
			buckets.delete(key);
		}
	}
}

export function checkRateLimit(event: RequestEvent, rule: RateLimitRule): RateLimitResult {
	const now = Date.now();
	compactBuckets(now);

	const ipHash = hashClientIp(getClientIp(event));
	const key = `${rule.bucket}:${ipHash}`;
	const current = buckets.get(key);

	if (!current || current.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
		return { allowed: true, retryAfterSeconds: 0 };
	}

	if (current.count >= rule.maxRequests) {
		return {
			allowed: false,
			retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
		};
	}

	current.count += 1;
	buckets.set(key, current);
	return { allowed: true, retryAfterSeconds: 0 };
}
