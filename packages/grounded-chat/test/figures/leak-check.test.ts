import { describe, expect, it } from "vitest";
import { findLeaks, hasLeak } from "../../src/index.js";

const authorized = [1676, 1500.5, 120];

describe("findLeaks", () => {
  it("passes a reply that only repeats returned amounts, in any of the usual formats", () => {
    for (const reply of [
      "Your indicative annual premium is 1676.00 EUR.",
      "That is 1,676.00 euros a year, or 1676 in round figures.",
      "Votre prime est de 1 676,00 EUR.",
      "The fee is 120.00 EUR and healthcare is 1500.50 EUR.",
    ]) {
      expect(hasLeak(findLeaks(reply, authorized)), reply).toBe(false);
    }
  });

  it("leaves ages, counts and years alone", () => {
    expect(hasLeak(findLeaks("For 2 adults aged 22 and 35, starting in 2026, cover runs 12 months.", authorized))).toBe(false);
  });

  it("catches a bare figure the guard's money pattern lets through", () => {
    expect(findLeaks("Roughly 1700 for the year.", authorized).amounts).toEqual([1700]);
  });

  it("catches a discounted or invented decimal amount", () => {
    expect(findLeaks("With the discount it comes to 999.99.", authorized).amounts).toEqual([999.99]);
  });

  it("catches an amount written in words, in English and French", () => {
    expect(findLeaks("About one thousand seven hundred euros.", authorized).words.length).toBeGreaterThan(0);
    expect(findLeaks("Environ mille sept cents euros.", authorized).words.length).toBeGreaterThan(0);
  });
});
