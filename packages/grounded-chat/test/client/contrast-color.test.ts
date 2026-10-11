import { describe, expect, it } from "vitest";
import { contrastTextColor } from "../../src/client/index.js";

describe("contrastTextColor", () => {
  it("defaults to white when no color is given", () => {
    expect(contrastTextColor(undefined)).toBe("#ffffff");
  });

  it("returns white for falsy/malformed input instead of guessing", () => {
    expect(contrastTextColor("")).toBe("#ffffff");
    expect(contrastTextColor("not-a-color")).toBe("#ffffff");
    expect(contrastTextColor("#12")).toBe("#ffffff");
  });

  it("expands a 3-digit hex before computing", () => {
    // #000 (black) should pick white text just like #000000.
    expect(contrastTextColor("#000")).toBe("#ffffff");
  });

  it("picks white text for a dark background", () => {
    expect(contrastTextColor("#111827")).toBe("#ffffff");
    expect(contrastTextColor("#000000")).toBe("#ffffff");
  });

  it("picks dark text for a light background", () => {
    expect(contrastTextColor("#facc15")).toBe("#111827"); // yellow
    expect(contrastTextColor("#ffffff")).toBe("#111827");
  });

  // Round-4 QA fix: the previous linear-brightness heuristic scored pure red as "dark
  // enough" for white text, but white-on-#ff0000 is only ~4.0:1 contrast, below the
  // 4.5:1 AA threshold for normal text — dark text is the objectively better choice.
  it("picks dark text for saturated red, unlike the old linear-brightness heuristic", () => {
    expect(contrastTextColor("#ff0000")).toBe("#111827");
  });

  it("picks white text for a medium-dark blue", () => {
    expect(contrastTextColor("#2563eb")).toBe("#ffffff");
  });
});
