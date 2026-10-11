import { describe, expect, it } from "vitest";
import { clientKey } from "../../src/http/index.js";

function requestWith(headers: Record<string, string>): Headers {
  return new Headers(headers);
}

describe("clientKey", () => {
  it("prefers x-real-ip (platform-set) over a client-supplied x-forwarded-for chain", () => {
    const request = requestWith({
      "x-real-ip": "203.0.113.9",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    });
    expect(clientKey(request)).toBe("203.0.113.9");
  });

  it("falls back to only the first x-forwarded-for hop, not the whole chain", () => {
    // Finding H3: keying on the whole chain let a caller mint a new bucket per request.
    expect(clientKey(requestWith({ "x-forwarded-for": "198.51.100.5, 10.0.0.1" }))).toBe("198.51.100.5");
  });

  it("does not vary the key when a spoofed trailing hop changes", () => {
    const a = clientKey(requestWith({ "x-forwarded-for": "198.51.100.5, 10.0.0.1" }));
    const b = clientKey(requestWith({ "x-forwarded-for": "198.51.100.5, 172.16.9.9" }));
    expect(a).toBe(b);
  });

  it("returns 'unknown' when no client IP header is present", () => {
    expect(clientKey(requestWith({}))).toBe("unknown");
  });
});
