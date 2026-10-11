/** One stated figure inside a reply: its character range and its value. */
export interface FigureSpan {
  start: number;
  end: number;
  /** The figure in digits, normalised by its class; null for a figure in words, which no tool result authorizes. */
  value: number | null;
}

/**
 * What counts as a figure for one kind of fact. The whole-reply guard, the streaming guard and the
 * leak check all read figures through the same class, so the three never disagree about what a
 * figure is.
 */
export interface FigureClass {
  /** A stable name, such as `money` or `measure`. */
  readonly id: string;
  /** Every figure the text states, in order, never overlapping. */
  findSpans(text: string): FigureSpan[];
  /**
   * Whether a word that has arrived in a stream could still be part of a figure once the words after
   * it are known. The streaming guard holds such words back.
   */
  couldBePartOfFigure(word: string): boolean;
  /** The form a value is compared in, so a figure and the tool value it restates match. */
  normalize(value: number): number;
}

/** The text a held-back figure is replaced with, per language. */
export const DEFAULT_REPLACEMENTS = {
  en: "an amount I can't confirm right now",
  fr: "un montant que je ne peux pas confirmer pour le moment",
} as const;

/** Options shared by every guard function. */
export interface GuardOptions {
  /** Which figures to guard; money when absent. */
  figureClass?: FigureClass;
  /** What replaces a figure no tool returned; the English default when absent. */
  replacement?: string;
}

export function authorizedSet(figureClass: FigureClass, authorized: readonly number[]): Set<number> {
  return new Set(authorized.map((value) => figureClass.normalize(value)));
}

export function isAuthorized(span: FigureSpan, authorized: Set<number>): boolean {
  return span.value !== null && authorized.has(span.value);
}
