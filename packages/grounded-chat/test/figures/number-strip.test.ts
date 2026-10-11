import { describe, expect, it } from "vitest";
import { stripUnauthorizedNumbers } from "../../src/index.js";

const AUTHORIZED = [1210, 288.14, 8.64, 17, 3, 1480.0];

describe("stripUnauthorizedNumbers", () => {
  it("passes an authorized snapshot number through unchanged", () => {
    const result = stripUnauthorizedNumbers("Your annual price is 1480.00 EUR.", AUTHORIZED);
    expect(result.text).toBe("Your annual price is 1480.00 EUR.");
    expect(result.redactedAmounts).toEqual([]);
  });

  it("redacts an invented total not present in any snapshot", () => {
    const result = stripUnauthorizedNumbers("It looks like around 1200.00 EUR annually.", AUTHORIZED);
    expect(result.text).not.toContain("1200.00");
    expect(result.redactedAmounts).toEqual([1200]);
  });

  it("still recognises an authorized amount through mangled/thousands-separator formatting", () => {
    // Same value as the golden 1480.00 case, just with a thousands separator — this
    // must NOT be treated as a different, unauthorized number.
    const result = stripUnauthorizedNumbers("The total comes to 1,480.00 EUR.", AUTHORIZED);
    expect(result.text).toContain("1,480.00");
    expect(result.redactedAmounts).toEqual([]);
  });

  it("does not flag numbers inside words or codes (no currency marker, no two-decimal fraction)", () => {
    const result = stripUnauthorizedNumbers(
      "Under our COVID-19 policy PLAN-KX-01, cover applies 24/7.",
      AUTHORIZED,
    );
    expect(result.text).toBe("Under our COVID-19 policy PLAN-KX-01, cover applies 24/7.");
    expect(result.redactedAmounts).toEqual([]);
  });

  it("redacts every invented amount and reports each one", () => {
    const result = stripUnauthorizedNumbers("Maybe 500 EUR, or perhaps 750.00 EUR depending on the day.", AUTHORIZED);
    expect(result.redactedAmounts).toEqual([500, 750]);
    expect(result.text).not.toContain("500");
    expect(result.text).not.toContain("750.00");
  });

  it("authorizes a benefit limit surfaced via a lookup tool, not just totals", () => {
    const result = stripUnauthorizedNumbers("Private room cover is capped at 80.00 EUR per day.", [80]);
    expect(result.redactedAmounts).toEqual([]);
  });

  it("redacts a currency-symbol-prefixed invented amount", () => {
    const result = stripUnauthorizedNumbers("That should run you about €900 a year.", AUTHORIZED);
    expect(result.redactedAmounts).toEqual([900]);
  });

  it("leaves plain non-monetary numbers (age, counts) alone", () => {
    const result = stripUnauthorizedNumbers("For a 22 year old with 2 dependants.", AUTHORIZED);
    expect(result.text).toBe("For a 22 year old with 2 dependants.");
    expect(result.redactedAmounts).toEqual([]);
  });

  // Round-4 QA fix, C1: a 4+ digit decimal amount with no comma and no adjacent
  // currency marker used to match none of the guard's alternatives and pass through
  // completely unredacted — exactly the failure mode this guard exists to prevent.
  it("redacts a 4+ digit ungrouped decimal amount with no adjacent currency marker", () => {
    const result = stripUnauthorizedNumbers("The price is 1901.50 for this cover.", AUTHORIZED);
    expect(result.text).not.toContain("1901.50");
    expect(result.redactedAmounts).toEqual([1901.5]);
  });

  it("still authorizes a 4+ digit ungrouped decimal amount that IS in the snapshot", () => {
    const result = stripUnauthorizedNumbers("That comes to 12345.67 in total.", [12345.67]);
    expect(result.text).toContain("12345.67");
    expect(result.redactedAmounts).toEqual([]);
  });

  it("redacts a spelled-out currency word, not just a symbol or ISO code", () => {
    const result = stripUnauthorizedNumbers("Roughly 1900 euros in total.", AUTHORIZED);
    expect(result.text).not.toContain("1900");
    expect(result.redactedAmounts).toEqual([1900]);
  });

  it("redacts a bare figure of 100 or more with no currency marker", () => {
    const result = stripUnauthorizedNumbers("Call it 1700 a year.", AUTHORIZED);
    expect(result.text).toBe("Call it an amount I can't confirm right now a year.");
    expect(result.redactedAmounts).toEqual([1700]);
  });

  it("redacts an amount written in words, which no figure can authorize", () => {
    const result = stripUnauthorizedNumbers("That is one thousand four hundred eighty euros.", AUTHORIZED);
    expect(result.text).toBe("That is an amount I can't confirm right now.");
    expect(result.redactedWords).toEqual(["one thousand four hundred eighty euros"]);
  });

  it("authorizes a French-formatted amount the snapshot holds, and redacts one it does not", () => {
    const result = stripUnauthorizedNumbers("Votre prime est de 1 480,00 €, pas 1 500,00 €.", AUTHORIZED);
    expect(result.text).toBe("Votre prime est de 1 480,00 €, pas an amount I can't confirm right now.");
    expect(result.redactedAmounts).toEqual([1500]);
  });

  it("leaves counts followed by a unit word alone", () => {
    const text = "Cover in 150 countries, for up to 365 days, at 100 % of costs.";
    expect(stripUnauthorizedNumbers(text, AUTHORIZED)).toEqual({ text, redactedAmounts: [], redactedWords: [] });
  });
});
