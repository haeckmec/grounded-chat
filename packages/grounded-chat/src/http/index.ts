/**
 * HTTP-layer guards for a host's public chat endpoints: per-key rate limit, origin allowlist,
 * client key, and one guard that applies both to a Web `Request`. No framework and no env: the host
 * reads its own configuration and passes it in.
 */
export { isMessageCapExceeded, isTokenBudgetExceeded } from '../limits.js';

export interface RateLimiter {
  /** True when the request may proceed, false when the key is over its limit. */
  check(key: string): boolean;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}

// Above this many tracked keys, expired windows are swept before adding more. Without it a caller
// cycling through distinct keys grows memory without bound. The sweep is amortised: it runs only
// when the map is already over the soft cap.
const MAX_TRACKED_KEYS = 10_000;

/**
 * Fixed-window, in-memory, per process. A deployment with several instances needs shared state
 * instead.
 */
export function createFixedWindowRateLimiter(options: RateLimitOptions): RateLimiter {
  const now = options.now ?? (() => Date.now());
  const hits = new Map<string, { windowStart: number; count: number }>();

  function pruneExpired(t: number): void {
    for (const [key, entry] of hits) {
      if (t - entry.windowStart >= options.windowMs) hits.delete(key);
    }
  }

  return {
    check(key: string): boolean {
      const t = now();
      if (hits.size > MAX_TRACKED_KEYS) pruneExpired(t);
      const entry = hits.get(key);
      if (!entry || t - entry.windowStart >= options.windowMs) {
        hits.set(key, { windowStart: t, count: 1 });
        return true;
      }
      if (entry.count >= options.maxRequests) return false;
      entry.count += 1;
      return true;
    },
  };
}

/**
 * An empty allowlist means none is configured: every origin passes. A configured allowlist is
 * strict: no origin, or one not listed, is refused.
 */
export function isOriginAllowed(origin: string | null, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!origin) return false;
  return allowlist.includes(origin);
}

/** Splits a comma-separated allowlist, such as an env var's value, into origins. */
export function parseOriginAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** The part of a request's headers the client key reads. */
export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * The rate-limit key for a public request. Never the whole `x-forwarded-for` chain, which a client
 * can set to mint a fresh bucket per request: `x-real-ip` first (an edge such as Vercel's sets it
 * and overwrites a client's), else only the first `x-forwarded-for` hop. Where nothing rewrites
 * these headers the key is only as trustworthy as the caller.
 */
export function clientKey(headers: HeaderReader): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const firstForwardedHop = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return firstForwardedHop || 'unknown';
}

/**
 * Origin allowlist and rate limit for a public POST endpoint. Returns the rejection to send, or null
 * when the request may proceed. Give each endpoint its own limiter so their budgets stay separate.
 */
export function guardPublicRequest(
  request: { headers: HeaderReader },
  rateLimiter: RateLimiter,
  originAllowlist: readonly string[],
): Response | null {
  if (!isOriginAllowed(request.headers.get('origin'), originAllowlist)) {
    return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  if (!rateLimiter.check(clientKey(request.headers))) {
    return Response.json({ error: 'Too many requests, please slow down.' }, { status: 429 });
  }
  return null;
}
