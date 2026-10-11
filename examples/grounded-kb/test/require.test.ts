import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// A CommonJS caller (a tsx script, a Jest setup) requires the ESM build through the `default` condition.
const require = createRequire(import.meta.url);

describe('built package from CommonJS', () => {
  it('requires the core and a subpath', () => {
    expect(typeof require('@haeckmec/grounded-chat').runTurn).toBe('function');
    expect(typeof require('@haeckmec/grounded-chat/eval').agreement).toBe('function');
  });
});
