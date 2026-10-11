import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "../../src/http/index.js";

describe("isOriginAllowed", () => {
  it("allows anything when no allowlist is configured", () => {
    expect(isOriginAllowed("https://evil.example", [])).toBe(true);
    expect(isOriginAllowed(null, [])).toBe(true);
  });

  it("allows a listed origin and rejects an unlisted one", () => {
    const allowlist = ["https://chatbot.example"];
    expect(isOriginAllowed("https://chatbot.example", allowlist)).toBe(true);
    expect(isOriginAllowed("https://evil.example", allowlist)).toBe(false);
  });

  it("rejects a missing origin header when an allowlist is configured", () => {
    expect(isOriginAllowed(null, ["https://chatbot.example"])).toBe(false);
  });
});
