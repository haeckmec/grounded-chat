import { describe, expect, it } from "vitest";
import { isMessageCapExceeded } from "../src/index.js";

describe("isMessageCapExceeded", () => {
  it("is not exceeded below the cap", () => {
    expect(isMessageCapExceeded(5, 20)).toBe(false);
  });

  it("is exceeded at or above the cap", () => {
    expect(isMessageCapExceeded(20, 20)).toBe(true);
    expect(isMessageCapExceeded(21, 20)).toBe(true);
  });
});
