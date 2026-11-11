import type { FigureClass, FigureSpan } from './figure-class.js';

/**
 * Measures: a quantity with a unit of volume, a count of dashes or drops, a ratio in parts, or a
 * strength in percent. For packs whose facts are specs and ratios rather than prices, so a reply can
 * only state the measures its tools returned.
 *
 * A measure is a number (digits, a decimal, a fraction such as 1/2, ½ or ⅝, or a number word up to
 * twelve) directly followed by a unit: ml, cl, l, oz, fl oz, dash(es), drop(s), barspoon(s),
 * tsp, tbsp, part(s), or % (with or without "ABV" or "abv"). A bare number without a unit is not a
 * measure. Values compare as given in their own unit, rounded to two decimals: "45 ml" and "4.5 cl"
 * are two different figures, so a tool returns every unit it allows the reply to use.
 */

const UNITS = [
  'fl\\.?\\s?oz', 'ml', 'cl', 'dl', 'l', 'oz', 'dashes', 'dash', 'drops', 'drop', 'barspoons', 'barspoon', 'bsp',
  'tsp', 'tbsp', 'parts', 'part', 'cups', 'cup', '%\\s?abv', '%',
];
const UNIT = `(?:${UNITS.join('|')})`;

const VULGAR: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};
// Every vulgar fraction above, as a regex character class: ounces are often written to the eighth.
const FRACTION = `[${Object.keys(VULGAR).join('')}]`;
const HAS_FRACTION = new RegExp(FRACTION, 'u');
const MIXED = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)(${FRACTION})?$`, 'u');
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5,
};

// A whole number with an optional vulgar fraction ("1½"), a decimal ("4.5", "4,5"), a slash fraction
// ("1/2"), a vulgar fraction alone, or a number word. The lookbehind keeps digits inside a longer
// token out, such as a code or a date.
const QUANTITY = String.raw`(?<![\p{L}\d_.,/])(\d+(?:[.,]\d+)?(?:\s?${FRACTION})?|\d+\s?\/\s?\d+|${FRACTION}|(?:${Object.keys(WORDS).join('|')}))`;
const MEASURE = new RegExp(String.raw`${QUANTITY}\s?(?:-\s?)?(${UNIT})(?![\p{L}\d])`, 'giu');

/** Units and number words the streaming guard holds back on. */
const HOLD = new Set([
  ...Object.keys(WORDS), 'ml', 'cl', 'dl', 'l', 'oz', 'fl', 'dash', 'dashes', 'drop', 'drops', 'barspoon', 'barspoons', 'bsp',
  'tsp', 'tbsp', 'part', 'parts', 'cup', 'cups', 'abv',
]);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseQuantity(raw: string): number | null {
  const text = raw.toLowerCase().replace(/\s/g, '');
  if (text in WORDS) return WORDS[text]!;
  if (text in VULGAR) return VULGAR[text]!;
  const slash = /^(\d+)\/(\d+)$/.exec(text);
  if (slash) return Number(slash[2]) === 0 ? null : Number(slash[1]) / Number(slash[2]);
  const mixed = MIXED.exec(text);
  if (!mixed) return null;
  const whole = Number((mixed[1] ?? '').replace(',', '.'));
  return Number.isFinite(whole) ? whole + (mixed[2] ? VULGAR[mixed[2]]! : 0) : null;
}

/** Every measure the text states. */
export function findMeasureSpans(text: string): FigureSpan[] {
  const spans: FigureSpan[] = [];
  for (const match of text.matchAll(MEASURE)) {
    const value = parseQuantity(match[1] ?? '');
    if (value === null) continue;
    spans.push({ start: match.index, end: match.index + match[0].length, value: round2(value) });
  }
  return spans;
}

/**
 * Measures: volumes, dashes and drops, parts and percent strength, compared in their own unit at two
 * decimals. Swap it for `moneyFigures` in a pack whose facts are specs and ratios.
 */
export const measureFigures: FigureClass = {
  id: 'measure',
  findSpans: findMeasureSpans,
  couldBePartOfFigure(word: string): boolean {
    if (/[\d%]/u.test(word) || HAS_FRACTION.test(word)) return true;
    return word
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .some((part) => HOLD.has(part));
  },
  normalize: round2,
};
