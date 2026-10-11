import { describe, expect, it } from "vitest";
import { stripUnauthorizedNumbers } from "../../src/index.js";
import { StreamingNumberGuard } from "../../src/index.js";

const AUTHORIZED = [1480, 1210, 288.14, 8.64, 80];

// Every class of amount the span finder knows, authorized and not, plus the near misses it must leave alone.
const REPLIES = [
  "Your indicative annual price is 1480.00 EUR.",
  "With a discount it would be 1500 EUR, so roughly 1,500.00.",
  "Roughly 1700 for the year, or €900 if you push.",
  "The price in words: one thousand four hundred eighty euros.",
  "Environ mille sept cents euros, soit 1 480,00 €.",
  "It covers 150 countries and 365 days, 100 % of costs.",
  "Cinq pour cent de remise sur 1210.00 EUR.",
  "A 100 per cent refund, or 200 pour cent.",
  "Private room is capped at 80.00 EUR per day, a hundred and fifty at most.",
  "For 2 adults aged 22 and 35, starting in 2026.",
  "Healthcare 1210.00, assistance 288.14, tax 8.64. Total 1480.00 EUR",
  "Ninety-nine euros a month, or 99.99.",
  "Call it 1700",
  "Under COVID-19 rules, cover applies 24/7 at 203.0.113.9.",
];

function stream(reply: string, cuts: number[]) {
  const guard = new StreamingNumberGuard(AUTHORIZED);
  const released: string[] = [];
  let last = 0;
  for (const cut of [...cuts, reply.length]) {
    released.push(guard.push(reply.slice(last, cut)));
    last = cut;
  }
  released.push(guard.end());
  return { guard, released };
}

function expectParity(reply: string, cuts: number[]) {
  const whole = stripUnauthorizedNumbers(reply, AUTHORIZED);
  const { guard, released } = stream(reply, cuts);
  const label = `${JSON.stringify(reply)} cut at ${cuts.join(",")}`;
  expect(released.join(""), label).toBe(whole.text);
  // Nothing is ever shown that the whole-reply guard would not show: every released prefix is a prefix of its text.
  let shown = "";
  for (const delta of released) {
    shown += delta;
    expect(whole.text.startsWith(shown), label).toBe(true);
  }
  expect(guard.redactedAmounts, label).toEqual(whole.redactedAmounts);
  expect(guard.redactedWords, label).toEqual(whole.redactedWords);
}

// Deterministic, so a failing chunking can be replayed.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe("StreamingNumberGuard", () => {
  it("matches the whole-reply guard when the reply arrives in one piece", () => {
    for (const reply of REPLIES) expectParity(reply, []);
  });

  it("matches the whole-reply guard for a cut at every character boundary", () => {
    for (const reply of REPLIES) {
      for (let cut = 1; cut < reply.length; cut++) expectParity(reply, [cut]);
    }
  });

  // Tens of thousands of streams by design: a shared CI runner, busy building in parallel, needs
  // more than the default five seconds for them.
  it("matches the whole-reply guard for every pair of cuts", { timeout: 60_000 }, () => {
    for (const reply of REPLIES) {
      for (let first = 1; first < reply.length; first++) {
        for (let second = first + 1; second < reply.length; second++) expectParity(reply, [first, second]);
      }
    }
  });

  it("matches the whole-reply guard for 1,000 random chunkings, down to one character per chunk", () => {
    const random = seededRandom(20261010);
    for (let run = 0; run < 1000; run++) {
      const reply = REPLIES[run % REPLIES.length]!;
      const cuts: number[] = [];
      let at = 0;
      for (;;) {
        at += 1 + Math.floor(random() * 6);
        if (at >= reply.length) break;
        cuts.push(at);
      }
      expectParity(reply, cuts);
    }
  });

  it("holds a figure split across chunks, then replaces it whole", () => {
    const guard = new StreamingNumberGuard(AUTHORIZED);
    expect(guard.push("That is 15")).toBe("That is ");
    expect(guard.push("00")).toBe("");
    expect(guard.push(" EUR")).toBe("");
    expect(guard.push(" this year. Then")).toBe("an amount I can't confirm right now this year. ");
    expect(guard.end()).toBe("Then");
  });

  it("releases an authorized figure as written once the word after it settles it", () => {
    const guard = new StreamingNumberGuard(AUTHORIZED);
    expect(guard.push("Total 1480.")).toBe("Total ");
    expect(guard.push("00 EUR for ")).toBe("1480.00 EUR for ");
  });

  it("releases plain prose at once, holding back only the last word while it may grow", () => {
    const guard = new StreamingNumberGuard(AUTHORIZED);
    expect(guard.push("Is this cover for yourself")).toBe("Is this cover for ");
    expect(guard.push(", a spouse?")).toBe("yourself, ");
    expect(guard.end()).toBe("a spouse?");
  });
});
