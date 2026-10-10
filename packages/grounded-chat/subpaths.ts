/**
 * Every public subpath of the package. The build entries are generated from
 * this list and a test checks it against the `exports` map in package.json,
 * so a subpath can't be published without a build entry or the other way round.
 */
export const SUBPATHS = [
  '.',
  './adapters/gemini',
  './adapters/dummy',
  './http',
  './client',
  './react',
  './admin',
  './admin-react',
  './eval',
] as const;
