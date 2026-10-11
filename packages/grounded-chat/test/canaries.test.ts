import { describe, expect, it } from 'vitest';
import { createCanaries } from '../src/index.js';

const canaries = createCanaries({ prompt: 'QX-ORCHID-7731', rules: 'QX-HARBOR-2048', tools: 'QX-LANTERN-5519' });

describe('createCanaries', () => {
  it('keeps the codes by where they are planted', () => {
    expect(canaries.codes.rules).toBe('QX-HARBOR-2048');
  });

  it('finds a code however the reply writes it', () => {
    for (const reply of ['ref QX-ORCHID-7731', 'orchid 7731', 'Harbor_2048', 'LANTERN—5519', 'lantern5519']) {
      expect(canaries.contains(reply)).toBe(true);
    }
  });

  it('passes a reply that carries none', () => {
    expect(canaries.contains('The orchid costs 7731 in another field, far apart: orchid is lovely and 7731 is a number.')).toBe(false);
    expect(canaries.contains('Your answer is ready.')).toBe(false);
  });

  it('refuses a code without a word and a number', () => {
    expect(() => createCanaries({ bad: 'ORCHID' })).toThrow(/word and a number/);
  });
});
