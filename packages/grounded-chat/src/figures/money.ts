import type { FigureClass, FigureSpan } from './figure-class.js';

/**
 * Money: the default figure class.
 *
 * An amount is:
 * - a number next to a currency sign, code or word, of any size;
 * - a number with one or two decimals;
 * - a bare whole number of 100 or more that is not a calendar year;
 * - a number written in words that contains a scale word (hundred, thousand, mille, cent) or sits
 *   next to a currency word.
 * A number directly followed by a unit word ("150 countries", "365 days", "100 %") is a count, not
 * an amount, unless a currency marker makes it one. Ages, counts below 100 and years are left alone,
 * since a reply names them legitimately.
 */

const CURRENCY_WORD = 'EUR|USD|GBP|euros?|dollars?|pounds?';

// Grouped thousands (comma, dot, space, or the no-break spaces French formatting uses) come first so
// "1 676,00" is read as one figure; a plain run of digits with an optional decimal mark is the rest.
const NUMBER_CORE = String.raw`\d{1,3}(?:[,.\u0020\u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

// The lookarounds keep digits inside a longer token out: codes ("COVID-19", "PLAN-01"), addresses
// ("203.0.113.9", "localhost:4000"), colours ("#18181b"), ranges of codes ("3166-1") and encoded text
// ("%23"). A letter straight after the digits ("0.299r") is a token too, unless it starts a currency
// code ("1676EUR").
const DIGIT_AMOUNT = new RegExp(
  String.raw`(?<![\p{L}\d_\-.:/@#%])([€$£]\s?)?(${NUMBER_CORE})(?![.,]?\d|-\d|_)(?:(\s?(?:[€$£]|(?:${CURRENCY_WORD})\b))|(?!\p{L}))`,
  'giu',
);

const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty',
  'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'a', 'and',
  'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze',
  'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'et',
];
const SCALE_WORDS = ['hundred', 'thousand', 'million', 'millions', 'cent', 'cents', 'mille'];
// Words that join a run but never start or end an amount on their own.
const CONNECTORS = new Set(['a', 'and', 'et', 'un', 'une']);

const LEXICON = [...SCALE_WORDS, ...NUMBER_WORDS].sort((a, b) => b.length - a.length).join('|');
const WORD_RUN = new RegExp(String.raw`\b(?:${LEXICON})\b(?:[\s-]+(?:${LEXICON})\b)*`, 'giu');
const SCALE = new RegExp(String.raw`\b(?:${SCALE_WORDS.join('|')})\b`, 'iu');
const CURRENCY_AFTER = new RegExp(String.raw`^\s?(?:[€$£]|(?:${CURRENCY_WORD})\b)`, 'iu');

const UNIT_WORDS = new Set([
  'day', 'days', 'night', 'nights', 'week', 'weeks', 'month', 'months', 'year', 'years', 'yrs', 'hour', 'hours',
  'country', 'countries', 'hospital', 'hospitals', 'clinic', 'clinics', 'people', 'persons', 'members',
  'km', 'kilometres', 'kilometers', 'miles', 'percent', '%',
  'jour', 'jours', 'nuit', 'nuits', 'semaine', 'semaines', 'mois', 'an', 'ans', 'année', 'années',
  'heure', 'heures', 'pays', 'personnes', 'membres',
]);

/** Every word that could be part of an amount. */
export const AMOUNT_WORDS: ReadonlySet<string> = new Set([
  ...NUMBER_WORDS,
  ...SCALE_WORDS,
  'eur', 'usd', 'gbp', 'euro', 'euros', 'dollar', 'dollars', 'pound', 'pounds',
]);

// "per" and "pour" are held too: "100 pour cent" is a percentage only once "cent" has arrived.
const HOLD_WORDS = new Set([...AMOUNT_WORDS, 'per', 'pour']);

function nextWord(text: string, from: number): string {
  const match = /^\s*([^\s]+)/u.exec(text.slice(from));
  if (!match) return '';
  return (match[1] ?? '').toLowerCase().replace(/^[^\p{L}\d%]+|[^\p{L}\d%]+$/gu, '');
}

function previousWord(text: string, before: number): string {
  const match = /([^\s]+)\s*$/u.exec(text.slice(0, before));
  return match ? (match[1] ?? '').toLowerCase() : '';
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseNumber(raw: string): number | null {
  const compact = raw.replace(/[\s\u00a0\u202f]/g, '');
  // A final comma or dot followed by one or two digits is the decimal mark; every other separator groups thousands.
  const decimal = /^(.*?)[.,](\d{1,2})$/.exec(compact);
  const whole = (decimal ? (decimal[1] ?? '') : compact).replace(/[.,]/g, '');
  const value = Number(decimal ? `${whole}.${decimal[2] ?? ''}` : whole);
  return Number.isFinite(value) ? roundToCents(value) : null;
}

function isUnitFollowing(text: string, end: number): boolean {
  if (text[end] === '%') return true;
  const word = nextWord(text, end);
  if (UNIT_WORDS.has(word)) return true;
  // "per cent" and "pour cent" read as a unit after a figure.
  return (word === 'per' || word === 'pour') && /^\s*\S+\s+cent\b/iu.test(text.slice(end));
}

function digitSpans(text: string): FigureSpan[] {
  const spans: FigureSpan[] = [];
  for (const match of text.matchAll(DIGIT_AMOUNT)) {
    const [whole, prefix, core = '', suffix] = match;
    const value = parseNumber(core);
    if (value === null) continue;
    const start = match.index;
    const end = start + whole.length;
    const hasCurrency = Boolean(prefix || suffix);
    if (!hasCurrency) {
      if (isUnitFollowing(text, end)) continue;
      const hasDecimals = /[.,]\d{1,2}$/.test(core);
      if (!hasDecimals && (value < 100 || /^(19|20)\d{2}$/.test(core))) continue;
    }
    spans.push({ start, end, value });
  }
  return spans;
}

function wordSpans(text: string): FigureSpan[] {
  const spans: FigureSpan[] = [];
  for (const match of text.matchAll(WORD_RUN)) {
    const tokens = [...match[0].matchAll(/[^\s-]+/gu)].map((token) => ({
      word: token[0].toLowerCase(),
      start: match.index + token.index,
      end: match.index + token.index + token[0].length,
    }));
    // A connector never ends an amount, and starts one only as the "a" of "a hundred".
    while (tokens.length > 0 && CONNECTORS.has(tokens[tokens.length - 1]!.word)) tokens.pop();
    while (tokens.length > 1 && CONNECTORS.has(tokens[0]!.word) && tokens[0]!.word !== 'a') tokens.shift();
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    if (!first || !last) continue;
    const start = first.start;
    let end = last.end;
    const run = text.slice(start, end);
    const currency = CURRENCY_AFTER.exec(text.slice(end));
    if (!SCALE.test(run) && !currency) continue;
    if (!currency) {
      if (isUnitFollowing(text, end)) continue;
      // "cinq pour cent": the "cent" there is a percentage.
      if (/^cents?$/iu.test(run) && ['pour', 'per'].includes(previousWord(text, start))) continue;
    }
    if (currency) end += currency[0].length;
    spans.push({ start, end, value: null });
  }
  return spans;
}

/** Every amount of money the text states. */
export function findAmountSpans(text: string): FigureSpan[] {
  const spans = [...digitSpans(text), ...wordSpans(text)].sort((a, b) => a.start - b.start);
  // A digit span and a word span never describe the same characters, but keep the first if they ever touch.
  return spans.filter((span, index) => index === 0 || span.start >= spans[index - 1]!.end);
}

/** Money: amounts in digits or words, compared rounded to cents. The default class. */
export const moneyFigures: FigureClass = {
  id: 'money',
  findSpans: findAmountSpans,
  couldBePartOfFigure(word: string): boolean {
    if (/[\d€$£]/u.test(word)) return true;
    return word
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .some((part) => HOLD_WORDS.has(part));
  },
  normalize: roundToCents,
};
