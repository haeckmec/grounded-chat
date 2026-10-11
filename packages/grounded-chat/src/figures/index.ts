export {
  DEFAULT_REPLACEMENTS,
  type FigureClass,
  type FigureSpan,
  type GuardOptions,
} from './figure-class.js';
export { AMOUNT_WORDS, findAmountSpans, moneyFigures } from './money.js';
export {
  findLeaks,
  hasLeak,
  StreamingNumberGuard,
  stripUnauthorizedNumbers,
  type LeakReport,
  type StripResult,
} from './guard.js';
