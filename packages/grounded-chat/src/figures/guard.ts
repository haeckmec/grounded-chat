import {
  authorizedSet,
  DEFAULT_REPLACEMENTS,
  isAuthorized,
  type FigureClass,
  type FigureSpan,
  type GuardOptions,
} from './figure-class.js';
import { moneyFigures } from './money.js';

export interface StripResult {
  text: string;
  redactedAmounts: number[];
  /** Figures written in words, replaced whatever they said. */
  redactedWords: string[];
}

/**
 * Replaces, inside `text`, every figure span not in `authorized`. The streaming guard calls this on
 * each region it releases, so a streamed reply and a whole one are redacted by the same code.
 */
export function redactSpans(
  text: string,
  spans: readonly FigureSpan[],
  authorized: Set<number>,
  offset = 0,
  replacement: string = DEFAULT_REPLACEMENTS.en,
): StripResult {
  const redactedAmounts: number[] = [];
  const redactedWords: string[] = [];
  let out = '';
  let cursor = 0;
  for (const span of spans) {
    if (isAuthorized(span, authorized)) continue;
    const start = span.start - offset;
    const end = span.end - offset;
    if (span.value === null) redactedWords.push(text.slice(start, end));
    else redactedAmounts.push(span.value);
    out += text.slice(cursor, start) + replacement;
    cursor = end;
  }
  return { text: out + text.slice(cursor), redactedAmounts, redactedWords };
}

/**
 * The whole-reply guard: replaces every figure no tool returned. The model may only state values
 * present in `authorized`, so "the model narrates, the tools decide" is structural rather than a
 * prompt-only promise.
 */
export function stripUnauthorizedNumbers(draftReply: string, authorized: readonly number[], options: GuardOptions = {}): StripResult {
  const figureClass = options.figureClass ?? moneyFigures;
  return redactSpans(
    draftReply,
    figureClass.findSpans(draftReply),
    authorizedSet(figureClass, authorized),
    0,
    options.replacement ?? DEFAULT_REPLACEMENTS.en,
  );
}

/**
 * The guard for a reply that arrives in chunks. `push` returns only text that is safe to show now;
 * anything that could still turn into a figure is held until the words after it settle what it is,
 * then checked and released, or replaced, exactly as `stripUnauthorizedNumbers` would have treated
 * the whole reply. Joined together, everything `push` and `end` return equals the whole-reply
 * guard's text for any chunking.
 */
export class StreamingNumberGuard {
  private text = '';
  private released = 0;
  private readonly authorized: Set<number>;
  private readonly figureClass: FigureClass;
  private readonly replacement: string;
  readonly redactedAmounts: number[] = [];
  readonly redactedWords: string[] = [];

  constructor(authorized: readonly number[], options: GuardOptions = {}) {
    this.figureClass = options.figureClass ?? moneyFigures;
    this.replacement = options.replacement ?? DEFAULT_REPLACEMENTS.en;
    this.authorized = authorizedSet(this.figureClass, authorized);
  }

  push(delta: string): string {
    this.text += delta;
    return this.releaseTo(this.safeCut());
  }

  end(): string {
    return this.releaseTo(this.text.length);
  }

  /**
   * The furthest point no figure can still cross. The last word is held while it may still grow,
   * and so is every word before it that could be part of a figure, back to the first word that
   * cannot. A figure's verdict depends on the word after it (a currency or a unit), so a held run
   * is released only once a complete word that cannot be part of a figure follows it.
   */
  private safeCut(): number {
    let cut = this.text.length;
    if (!/\s$/u.test(this.text)) {
      const lastWord = /\S+$/u.exec(this.text);
      if (lastWord) cut = lastWord.index;
    }
    for (;;) {
      const before = /(\S+)(\s*)$/u.exec(this.text.slice(0, cut));
      if (!before || !this.figureClass.couldBePartOfFigure(before[1] ?? '')) break;
      cut = before.index;
    }
    return Math.max(cut, this.released);
  }

  private releaseTo(cut: number): string {
    if (cut <= this.released) return '';
    const settled = this.text.slice(0, cut);
    // A span reaching back into released text cannot happen with a safe cut; if one ever did, the
    // part not yet shown is still replaced rather than let through.
    const spans = this.figureClass
      .findSpans(settled)
      .filter((span) => span.end > this.released)
      .map((span) => ({ ...span, start: Math.max(span.start, this.released) }));
    const result = redactSpans(settled.slice(this.released), spans, this.authorized, this.released, this.replacement);
    this.redactedAmounts.push(...result.redactedAmounts);
    this.redactedWords.push(...result.redactedWords);
    this.released = cut;
    return result.text;
  }
}

export interface LeakReport {
  /** Figures in digits no tool returned. */
  amounts: number[];
  /** Figures written in words, which no tool value can authorize. */
  words: string[];
}

/**
 * The after-the-fact check on a reply that already went through the guard: did any figure no tool
 * returned still reach the user? It reads figures with the same class the guard redacts with, so on
 * a reply the guard handled it finds nothing; a leak means the guard was bypassed or the class
 * missed a way of writing a figure.
 */
export function findLeaks(reply: string, authorized: readonly number[], options: Pick<GuardOptions, 'figureClass'> = {}): LeakReport {
  const figureClass = options.figureClass ?? moneyFigures;
  const allowed = authorizedSet(figureClass, authorized);
  const amounts: number[] = [];
  const words: string[] = [];
  for (const span of figureClass.findSpans(reply)) {
    if (isAuthorized(span, allowed)) continue;
    if (span.value === null) words.push(reply.slice(span.start, span.end));
    else amounts.push(span.value);
  }
  return { amounts, words };
}

/** True when the report found any figure. */
export function hasLeak(report: LeakReport): boolean {
  return report.amounts.length > 0 || report.words.length > 0;
}
