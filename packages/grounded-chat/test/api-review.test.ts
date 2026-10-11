import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SUBPATHS } from '../subpaths.js';

// The API review, automated: every name a subpath exports carries a doc comment, and every runtime
// export (function, class, constant) appears in at least one test, of this package or of the example
// consumer. Exported types are exercised by those tests compiling against them.
const root = fileURLToPath(new URL('..', import.meta.url));
const entry = (subpath: string) => join(root, 'src', subpath === '.' ? '' : subpath.slice(2), 'index.ts');

const program = ts.createProgram(SUBPATHS.map(entry), {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  skipLibCheck: true,
});
const checker = program.getTypeChecker();

function exportsOf(subpath: string): Array<{ name: string; documented: boolean; value: boolean }> {
  const source = program.getSourceFile(entry(subpath));
  if (!source) throw new Error(`no source for ${subpath}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) return [];
  return checker.getExportsOfModule(moduleSymbol).map((symbol) => {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const docs = ts.displayPartsToString(target.getDocumentationComment(checker)).trim();
    // A doc comment on any declaration counts, including on an interface's or type's own declaration.
    const declared = (target.declarations ?? []).some((declaration) => ts.getJSDocCommentsAndTags(declaration).length > 0);
    return { name: symbol.name, documented: docs.length > 0 || declared, value: (target.flags & ts.SymbolFlags.Value) !== 0 };
  });
}

function testSources(dir: string): string {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .map((path) => (statSync(path).isDirectory() ? testSources(path) : /\.test\.tsx?$|helpers/.test(path) ? readFileSync(path, 'utf8') : ''))
    .join('\n');
}
const allTests = testSources(join(root, 'test')) + testSources(join(root, '../../examples/grounded-kb/test'));

describe('API review', () => {
  for (const subpath of SUBPATHS) {
    const names = exportsOf(subpath);

    it(`${subpath}: every export has a doc comment`, () => {
      expect(names.filter((e) => !e.documented).map((e) => e.name)).toEqual([]);
    });

    it(`${subpath}: every runtime export is used in a test`, () => {
      expect(names.filter((e) => e.value && !new RegExp(`\\b${e.name}\\b`).test(allTests)).map((e) => e.name)).toEqual([]);
    });
  }
});
