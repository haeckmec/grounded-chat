/** What an embed page reads from its query string. */
export interface EmbedParams<L extends string = string> {
  /** The host page's origin, the only target a message to the parent may be posted to. */
  parentOrigin: string;
  lang?: L | undefined;
  /** A hex colour, or undefined when absent or not a hex literal. */
  primaryColor?: string | undefined;
  font?: string | undefined;
  /** The pack's own parameters, by name. */
  values: Record<string, string>;
}

export interface EmbedParamsSpec<L extends string = string> {
  /** Parameters the embed cannot start without, checked first and in order. */
  required?: readonly string[];
  optional?: readonly string[];
  /** Accepted values of `lang`; any other value reads as absent. */
  languages?: readonly L[];
}

/**
 * A bare origin only, such as "https://host" or "http://localhost:3000": no path, query or trailing
 * slash. It is what postMessage's targetOrigin needs.
 */
export function isValidOrigin(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
  } catch {
    return false;
  }
}

/** A hex colour literal or undefined, so a hostile query string cannot reach an inline style. */
export function sanitizeHexColor(value: string | null | undefined): string | undefined {
  if (value && /^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  return undefined;
}

/** Parses an embed page's query string, or names the first missing or invalid parameter. */
export function parseEmbedParams<L extends string = string>(
  params: URLSearchParams,
  spec: EmbedParamsSpec<L> = {},
): EmbedParams<L> | { error: string } {
  const values: Record<string, string> = {};
  for (const name of spec.required ?? []) {
    const value = params.get(name);
    if (!value) return { error: `Missing ${name}.` };
    values[name] = value;
  }
  const parentOrigin = params.get('parentOrigin');
  if (!isValidOrigin(parentOrigin)) return { error: 'Missing or invalid parentOrigin.' };
  for (const name of spec.optional ?? []) {
    const value = params.get(name);
    if (value !== null) values[name] = value;
  }
  const langRaw = params.get('lang');
  const lang = spec.languages?.find((language) => language === langRaw);
  return {
    parentOrigin,
    lang,
    primaryColor: sanitizeHexColor(params.get('primaryColor')),
    font: params.get('font') ?? undefined,
    values,
  };
}
