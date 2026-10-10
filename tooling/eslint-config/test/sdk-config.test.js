import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { findDomainWord, sdk } from '../index.js';

// Lints snippets as if they sat at `filePath` inside the SDK package, so the
// path-scoped purity rules apply exactly as they do in the real package.
const eslint = new ESLint({
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  overrideConfigFile: true,
  overrideConfig: sdk,
});

async function ruleIds(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

describe('findDomainWord', () => {
  it.each([
    ['quoteId', 'quote'],
    ['QUOTE_ID', 'quote'],
    ['renderQuotes', 'quote'],
    ['progressBar', 'bar'],
    ['the rate table is loaded', 'rate table'],
    ['rateTables', 'rate table'],
    ['insurancePremium', 'insurance'],
    ['drinks', 'drink'],
    ['Cocktail', 'cocktail'],
  ])('flags %s', (text, word) => {
    expect(findDomainWord(text)).toBe(word);
  });

  it.each(['toolbar', 'barrier', 'quoted', 'rate limit', 'policy', 'intakePolicy', 'unquote', 'tablet'])(
    'passes %s',
    (text) => {
      expect(findDomainWord(text)).toBeNull();
    },
  );
});

describe('sdk config: domain words', () => {
  it('flags identifiers, strings, templates and comments in src', async () => {
    const code = [
      '// pick the cheapest premium',
      'export const quoteId = 1;',
      "export const label = 'drink';",
      'export const tpl = `cocktail ${quoteId}`;',
    ].join('\n');
    const ids = await ruleIds(code, 'src/core.ts');
    expect(ids.filter((id) => id === 'local/no-domain-words')).toHaveLength(5);
  });

  it('flags domain words inside adapters too', async () => {
    expect(await ruleIds('export const quote = 1;', 'src/adapters/gemini/x.ts')).toContain('local/no-domain-words');
  });

  it('ignores files outside src', async () => {
    expect(await ruleIds('export const quote = 1;', 'test/x.ts')).not.toContain('local/no-domain-words');
  });
});

describe('sdk config: purity', () => {
  it.each([
    ['fetch', "export const r = fetch('x');", 'no-restricted-globals'],
    ['process.env', 'export const k = process.env.KEY;', 'no-restricted-globals'],
    ['import.meta.env', 'export const k = import.meta.env.KEY;', 'no-restricted-syntax'],
    ['node:fs', "import { readFileSync } from 'node:fs';\nexport const r = readFileSync;", 'no-restricted-imports'],
    ['fs', "import fs from 'fs';\nexport const r = fs;", 'no-restricted-imports'],
  ])('refuses %s in the core', async (_name, code, ruleId) => {
    expect(await ruleIds(code, 'src/http/x.ts')).toContain(ruleId);
  });

  it('allows network and env access in adapters', async () => {
    const code = "export const r = fetch('x');\nexport const k = process.env.KEY;";
    const ids = await ruleIds(code, 'src/adapters/gemini/x.ts');
    expect(ids).not.toContain('no-restricted-globals');
  });

  it('refuses console anywhere in src', async () => {
    expect(await ruleIds("console.log('x');", 'src/adapters/dummy/x.ts')).toContain('no-console');
    expect(await ruleIds("console.log('x');", 'src/x.ts')).toContain('no-console');
  });
});
