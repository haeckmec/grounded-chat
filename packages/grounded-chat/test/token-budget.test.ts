import { describe, expect, it } from "vitest";
import { isTokenBudgetExceeded } from "../src/index.js";

describe("isTokenBudgetExceeded", () => {
  it("is not exceeded below the budget", () => {
    expect(isTokenBudgetExceeded(500, 2000)).toBe(false);
  });

  it("is exceeded at or above the budget", () => {
    expect(isTokenBudgetExceeded(2000, 2000)).toBe(true);
    expect(isTokenBudgetExceeded(2001, 2000)).toBe(true);
  });

  it("is never exceeded when no budget is configured", () => {
    expect(isTokenBudgetExceeded(1_000_000, undefined)).toBe(false);
  });
});
