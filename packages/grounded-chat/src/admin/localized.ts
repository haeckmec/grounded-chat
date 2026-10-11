/** Text an admin writes once per language. */
export type LocalizedText<L extends string = 'en' | 'fr'> = Record<L, string>;
/** A list an admin writes once per language. */
export type LocalizedList<L extends string = 'en' | 'fr'> = Record<L, string[]>;

/**
 * Reads a stored localized text whatever shape it was saved in. A plain string, saved before the
 * field had languages, is kept as the first language and the rest fall back; a partial object keeps
 * what it has. Anything else is the fallback.
 */
export function coerceLocalizedText<L extends string>(value: unknown, fallback: LocalizedText<L>): LocalizedText<L> {
  const languages = Object.keys(fallback) as L[];
  if (typeof value === 'string') return { ...fallback, [languages[0]!]: value };
  if (value && typeof value === 'object') {
    const v = value as Partial<Record<L, unknown>>;
    if (languages.some((language) => typeof v[language] === 'string')) {
      return Object.fromEntries(languages.map((language) => [language, typeof v[language] === 'string' ? v[language] : fallback[language]])) as LocalizedText<L>;
    }
  }
  return fallback;
}

/** The list counterpart of `coerceLocalizedText`. */
export function coerceLocalizedList<L extends string>(value: unknown, fallback: LocalizedList<L>): LocalizedList<L> {
  const languages = Object.keys(fallback) as L[];
  if (Array.isArray(value)) return { ...fallback, [languages[0]!]: value };
  if (value && typeof value === 'object') {
    const v = value as Partial<Record<L, unknown>>;
    if (languages.some((language) => Array.isArray(v[language]))) {
      return Object.fromEntries(languages.map((language) => [language, Array.isArray(v[language]) ? v[language] : fallback[language]])) as LocalizedList<L>;
    }
  }
  return fallback;
}
