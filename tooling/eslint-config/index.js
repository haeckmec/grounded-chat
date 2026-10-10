import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import noDomainWords from './rules/no-domain-words.js';

export { DEFAULT_WORDS, findDomainWord, toWords } from './rules/no-domain-words.js';

export const plugin = { rules: { 'no-domain-words': noDomainWords } };

/** Base config for every workspace: recommended JS and TypeScript rules. */
export const base = [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];

// The core may run on any runtime (server, edge, browser), so it can't reach
// for the network, the environment or the file system. Only adapters may.
const purity = {
  'no-restricted-globals': [
    'error',
    ...['fetch', 'process', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Deno', 'Bun'].map((name) => ({
      name,
      message: 'The core is pure: network and environment access belong in src/adapters/.',
    })),
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          regex: '^(node:.*|fs|fs/.*|path|os|child_process|http|https|net|tls|dns|process|worker_threads|dotenv)$',
          message: 'The core is pure: no Node built-ins or env loaders outside src/adapters/.',
        },
      ],
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
      message: 'The core is pure: read configuration from arguments, never import.meta.env.',
    },
  ],
};

/**
 * Config for the SDK package, with paths relative to its folder: the purity
 * rules outside adapters, the domain-word rule and no console output anywhere
 * in the source.
 */
export const sdk = [
  ...base,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { local: plugin },
    rules: {
      'local/no-domain-words': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/adapters/**'],
    rules: purity,
  },
];
