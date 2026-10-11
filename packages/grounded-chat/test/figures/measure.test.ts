import { describe, expect, it } from 'vitest';
import { findLeaks, findMeasureSpans, measureFigures, StreamingNumberGuard, stripUnauthorizedNumbers } from '../../src/index.js';

const read = (text: string) => findMeasureSpans(text).map((span) => [text.slice(span.start, span.end), span.value]);
const guard = { figureClass: measureFigures };

describe('measureFigures', () => {
  it('reads volumes, counts, parts and strength with their unit', () => {
    expect(read('Stir 45 ml of spirit, 4,5 cl of it, 1½ oz, 3/4 fl oz and two dashes over 1 l of ice.')).toEqual([
      ['45 ml', 45],
      ['4,5 cl', 4.5],
      ['1½ oz', 1.5],
      ['3/4 fl oz', 0.75],
      ['two dashes', 2],
      ['1 l', 1],
    ]);
    expect(read('Mix 2 parts to 1 part, ½ barspoon, 40% ABV, 12 drops, half tsp.')).toEqual([
      ['2 parts', 2],
      ['1 part', 1],
      ['½ barspoon', 0.5],
      ['40% ABV', 40],
      ['12 drops', 12],
      ['half tsp', 0.5],
    ]);
  });

  it('leaves numbers without a unit and units inside words alone', () => {
    expect(read('Serve 2 glasses in 1987 to table 12, with 5 lemons, a part of the method, ref QX-7731.')).toEqual([]);
    expect(read('Use 10 mlx or 3 ozone.')).toEqual([]);
  });

  it('catches each end of a range', () => {
    expect(read('1-2 oz')).toEqual([['2 oz', 2]]);
  });

  it('guards a reply: only the measures a tool returned pass, streamed or whole', () => {
    const reply = 'Use 45 ml gin, 30 ml lemon and 3 dashes.';
    expect(stripUnauthorizedNumbers(reply, [45, 30], guard).text).toBe("Use 45 ml gin, 30 ml lemon and an amount I can't confirm right now.");
    const streaming = new StreamingNumberGuard([45, 30], { ...guard, replacement: 'an unverified measure' });
    const out = ['Use 4', '5 m', 'l gin, 30 ml lemon and 3 da', 'shes.'].map((d) => streaming.push(d)).join('') + streaming.end();
    expect(out).toBe('Use 45 ml gin, 30 ml lemon and an unverified measure.');
    expect(findLeaks(reply, [45, 30, 3], guard)).toEqual({ amounts: [], words: [] });
  });

  it('holds units and number words while they may still form a measure', () => {
    for (const word of ['45', 'ml', 'dashes', 'two', '½', '40%', 'abv']) expect(measureFigures.couldBePartOfFigure(word)).toBe(true);
    expect(measureFigures.couldBePartOfFigure('lemon')).toBe(false);
    expect(measureFigures.normalize(0.755)).toBe(0.76);
  });
});

describe('measureFigures streaming parity', () => {
  const REPLIES = [
    'Use 45 ml gin, 30 ml lemon, 22.5 ml syrup and 2 dashes of bitters.',
    'Shake 1½ oz with ¾ oz, top with two parts soda to one part, 40% ABV.',
    'A spec I cannot back: 60 ml and 3 drops, or 1-2 oz, or half tsp.',
    'No measures here, only 12 glasses and the year 1987.',
  ];
  const AUTHORIZED = [45, 30, 2, 1.5, 0.75, 40];

  for (const reply of REPLIES) {
    it(`matches the whole-reply guard at every cut: ${reply.slice(0, 30)}…`, () => {
      const whole = stripUnauthorizedNumbers(reply, AUTHORIZED, guard).text;
      for (let cut = 0; cut <= reply.length; cut++) {
        const streaming = new StreamingNumberGuard(AUTHORIZED, guard);
        expect(streaming.push(reply.slice(0, cut)) + streaming.push(reply.slice(cut)) + streaming.end()).toBe(whole);
      }
      const oneByOne = new StreamingNumberGuard(AUTHORIZED, guard);
      expect([...reply].map((c) => oneByOne.push(c)).join('') + oneByOne.end()).toBe(whole);
    });
  }
});
