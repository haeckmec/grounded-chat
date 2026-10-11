import { describe, expect, it } from 'vitest';
import { createFixedWindowRateLimiter, guardPublicRequest, parseOriginAllowlist } from '../../src/http/index.js';

const request = (headers: Record<string, string>) => new Request('https://chat.example/api/chat', { method: 'POST', headers });

describe('guardPublicRequest', () => {
  it('lets an allowed origin through until its key runs out of budget', async () => {
    const limiter = createFixedWindowRateLimiter({ windowMs: 1000, maxRequests: 1, now: () => 0 });
    const allowed = request({ origin: 'https://chat.example', 'x-real-ip': '203.0.113.9' });
    expect(guardPublicRequest(allowed, limiter, ['https://chat.example'])).toBeNull();
    const limited = guardPublicRequest(allowed, limiter, ['https://chat.example']);
    expect(limited?.status).toBe(429);
    expect(await limited?.json()).toEqual({ error: 'Too many requests, please slow down.' });
  });

  it('refuses an origin outside a configured allowlist before spending budget', async () => {
    const limiter = createFixedWindowRateLimiter({ windowMs: 1000, maxRequests: 1, now: () => 0 });
    const refused = guardPublicRequest(request({ origin: 'https://evil.example' }), limiter, ['https://chat.example']);
    expect(refused?.status).toBe(403);
    expect(await refused?.json()).toEqual({ error: 'Origin not allowed.' });
    expect(guardPublicRequest(request({ origin: 'https://chat.example' }), limiter, ['https://chat.example'])).toBeNull();
  });
});

describe('parseOriginAllowlist', () => {
  it('splits on commas and drops blanks; unset is empty', () => {
    expect(parseOriginAllowlist(' https://a.example, ,https://b.example ')).toEqual(['https://a.example', 'https://b.example']);
    expect(parseOriginAllowlist(undefined)).toEqual([]);
  });
});
