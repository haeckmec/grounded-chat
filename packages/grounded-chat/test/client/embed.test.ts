import { describe, expect, it } from 'vitest';
import { FONT_OPTIONS, findFontOption, googleFontsHref, isValidOrigin, parseEmbedParams, sanitizeHexColor } from '../../src/client/index.js';

const query = (pairs: Record<string, string>) => new URLSearchParams(pairs);

describe('parseEmbedParams', () => {
  const spec = { required: ['tenant'], optional: ['ref'], languages: ['en', 'fr'] as const };

  it('reads the origin, language, theme and the pack parameters', () => {
    expect(parseEmbedParams(query({ tenant: 't1', ref: 'r', parentOrigin: 'https://host.example', lang: 'fr', primaryColor: '#639e30', font: 'Poppins' }), spec)).toEqual({
      parentOrigin: 'https://host.example',
      lang: 'fr',
      primaryColor: '#639e30',
      font: 'Poppins',
      values: { tenant: 't1', ref: 'r' },
    });
  });

  it('names a missing required parameter first, then a bad origin', () => {
    expect(parseEmbedParams(query({ parentOrigin: 'https://host.example' }), spec)).toEqual({ error: 'Missing tenant.' });
    expect(parseEmbedParams(query({ tenant: 't1', parentOrigin: 'https://host.example/path' }), spec)).toEqual({ error: 'Missing or invalid parentOrigin.' });
  });

  it('drops an unknown language and a colour that is not a hex literal', () => {
    const parsed = parseEmbedParams(query({ tenant: 't', parentOrigin: 'http://localhost:3000', lang: 'de', primaryColor: 'red;background:url(x)' }), spec);
    expect(parsed).toMatchObject({ lang: undefined, primaryColor: undefined });
  });
});

describe('origin and colour checks', () => {
  it('accepts only a bare http or https origin', () => {
    expect(isValidOrigin('https://a.example')).toBe(true);
    for (const bad of [null, '', 'https://a.example/', 'ftp://a.example', 'not a url']) expect(isValidOrigin(bad)).toBe(false);
  });

  it('keeps hex literals only', () => {
    expect(sanitizeHexColor('#fff')).toBe('#fff');
    expect(sanitizeHexColor('#12345678')).toBe('#12345678');
    expect(sanitizeHexColor('blue')).toBeUndefined();
  });
});

describe('fonts', () => {
  it('builds the stylesheet URL for a listed font only', () => {
    expect(FONT_OPTIONS.length).toBeGreaterThan(5);
    expect(findFontOption('Poppins')?.label).toBe('Poppins');
    expect(googleFontsHref('Poppins')).toBe('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
    expect(googleFontsHref('Comic Sans')).toBeUndefined();
    expect(googleFontsHref(undefined)).toBeUndefined();
  });
});
