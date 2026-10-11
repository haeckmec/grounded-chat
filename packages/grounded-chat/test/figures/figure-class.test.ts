import { describe, expect, it } from 'vitest';
import {
  AMOUNT_WORDS,
  DEFAULT_REPLACEMENTS,
  findLeaks,
  moneyFigures,
  StreamingNumberGuard,
  stripUnauthorizedNumbers,
  type FigureClass,
} from '../../src/index.js';

// A toy class for the options: any run of digits followed by "pts" is a figure.
const points: FigureClass = {
  id: 'points',
  findSpans: (text) =>
    [...text.matchAll(/(\d+) ?pts\b/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: Number(m[1]) })),
  couldBePartOfFigure: (word) => /\d|pts/.test(word),
  normalize: (value) => value,
};

describe('figure classes', () => {
  it('money is the default class: the guard with no options and with money explicitly agree', () => {
    const reply = 'It is 1676.00 EUR, or about 1700 for the year, or two thousand euros.';
    expect(stripUnauthorizedNumbers(reply, [1676])).toEqual(stripUnauthorizedNumbers(reply, [1676], { figureClass: moneyFigures }));
    expect(moneyFigures.id).toBe('money');
    expect(moneyFigures.normalize(10.005)).toBe(10.01);
  });

  it('every guard function reads figures through the class it is given', () => {
    const reply = 'You scored 40 pts, not 1676.00 EUR.';
    expect(stripUnauthorizedNumbers(reply, [], { figureClass: points }).text).toBe(
      `You scored ${DEFAULT_REPLACEMENTS.en}, not 1676.00 EUR.`,
    );
    expect(findLeaks(reply, [40], { figureClass: points })).toEqual({ amounts: [], words: [] });
    const guard = new StreamingNumberGuard([], { figureClass: points });
    expect(guard.push('You scored 4') + guard.push('0 pts today.') + guard.end()).toBe(`You scored ${DEFAULT_REPLACEMENTS.en} today.`);
  });

  it('replaces with the text the pack supplies, streamed or whole', () => {
    const replacement = DEFAULT_REPLACEMENTS.fr;
    expect(stripUnauthorizedNumbers('Prix : 900 EUR.', [], { replacement }).text).toBe(`Prix : ${replacement}.`);
    const guard = new StreamingNumberGuard([], { replacement });
    expect(guard.push('Prix : 90') + guard.push('0 EUR.') + guard.end()).toBe(`Prix : ${replacement}.`);
  });

  it('holds every word that could start or end an amount', () => {
    for (const word of ['thousand', 'cent', 'eur', 'dollars', 'two']) expect(AMOUNT_WORDS.has(word)).toBe(true);
    expect(moneyFigures.couldBePartOfFigure('per')).toBe(true);
    expect(moneyFigures.couldBePartOfFigure('€12')).toBe(true);
    expect(moneyFigures.couldBePartOfFigure('hello')).toBe(false);
  });
});
