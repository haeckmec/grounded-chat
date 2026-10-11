import { describe, expect, it } from "vitest";
import { createFixedWindowRateLimiter } from "../../src/http/index.js";

describe("createFixedWindowRateLimiter", () => {
  it("allows requests up to the max, then blocks within the same window", () => {
    const t = 0;
    const limiter = createFixedWindowRateLimiter({ windowMs: 1000, maxRequests: 3, now: () => t });

    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("resets after the window elapses", () => {
    let t = 0;
    const limiter = createFixedWindowRateLimiter({ windowMs: 1000, maxRequests: 1, now: () => t });

    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);
    t = 1001;
    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const limiter = createFixedWindowRateLimiter({ windowMs: 1000, maxRequests: 1 });
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });
});
