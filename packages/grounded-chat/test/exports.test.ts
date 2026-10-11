import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUBPATHS } from '../subpaths.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as {
  exports: Record<string, string | { types: string; import: string; default: string }>;
};

const folder = (subpath: string) => (subpath === '.' ? '' : `${subpath.slice(2)}/`);

describe('exports map', () => {
  it('lists exactly the declared subpaths plus package.json', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([...SUBPATHS, './package.json'].sort());
  });

  // `default` lets a CommonJS caller, such as a tsx script, require the ESM build (Node 20.19+).
  it.each(SUBPATHS)('%s points at its built module and types, for import and require', (subpath) => {
    expect(pkg.exports[subpath]).toEqual({
      types: `./dist/${folder(subpath)}index.d.ts`,
      import: `./dist/${folder(subpath)}index.js`,
      default: `./dist/${folder(subpath)}index.js`,
    });
  });

  it.each(SUBPATHS)('%s has a source entry', (subpath) => {
    expect(existsSync(`${root}src/${folder(subpath)}index.ts`)).toBe(true);
  });
});
