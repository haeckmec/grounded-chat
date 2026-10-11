import { describe, expect, it } from "vitest";
import { findAmountSpans } from "../../src/index.js";

function amounts(text: string) {
  return findAmountSpans(text).map((span) => ({ text: text.slice(span.start, span.end), value: span.value }));
}

describe("findAmountSpans", () => {
  it("reads a figure with a currency marker of any size, marker included in the span", () => {
    expect(amounts("About €50, or 1676.00 EUR, or 900 euros.")).toEqual([
      { text: "€50", value: 50 },
      { text: "1676.00 EUR", value: 1676 },
      { text: "900 euros", value: 900 },
    ]);
  });

  it("reads grouped thousands in English and French formatting as one figure", () => {
    expect(amounts("1,676.00 or 1 676,00 € or 1 676,00 €")).toEqual([
      { text: "1,676.00", value: 1676 },
      { text: "1 676,00 €", value: 1676 },
      { text: "1 676,00 €", value: 1676 },
    ]);
  });

  it("reads a bare whole number of 100 or more, and any number with decimals", () => {
    expect(amounts("Roughly 1700 for the year, or 99.99 with a discount.").map((a) => a.value)).toEqual([1700, 99.99]);
  });

  it("leaves ages, small counts and calendar years alone", () => {
    expect(amounts("For 2 adults aged 22 and 35, starting in 2026, cover runs 12 months.")).toEqual([]);
  });

  it("treats a figure followed by a unit word as a count", () => {
    expect(amounts("It covers 150 countries, 365 days a year, 100 % of costs, and 180 jours en France.")).toEqual([]);
  });

  it("keeps a currency figure an amount even when a unit follows", () => {
    expect(amounts("Capped at 500 EUR days apart.").map((a) => a.value)).toEqual([500]);
  });

  it("leaves digits inside codes, addresses and colours alone", () => {
    expect(amounts("COVID-19, STUDENT-EXPAT-01, 203.0.113.9, localhost:4000, #18181b, ISO 3166-1, 0.299r")).toEqual([]);
  });

  it("reads an amount in words with a scale word, in English and French", () => {
    expect(amounts("About one thousand seven hundred euros.")).toEqual([
      { text: "one thousand seven hundred euros", value: null },
    ]);
    expect(amounts("Environ mille sept cents euros.")).toEqual([{ text: "mille sept cents euros", value: null }]);
    expect(amounts("Maybe a hundred and fifty.")).toEqual([{ text: "a hundred and fifty", value: null }]);
  });

  it("reads small number words only next to a currency word", () => {
    expect(amounts("Ninety-nine euros a month for one person.")).toEqual([{ text: "Ninety-nine euros", value: null }]);
  });

  it("leaves percentages and counts in words alone", () => {
    expect(amounts("Cinq pour cent de remise, cover in a hundred countries, hundreds of clinics.")).toEqual([]);
  });
});
