import { describe, expect, it } from 'vitest';

// Imports every subpath by its public name through node_modules, the way an
// outside app would, so a broken exports map or a missing build output fails
// here instead of in a consumer.
const subpaths = {
  '@haeckmec/grounded-chat': () => import('@haeckmec/grounded-chat'),
  '@haeckmec/grounded-chat/adapters/gemini': () => import('@haeckmec/grounded-chat/adapters/gemini'),
  '@haeckmec/grounded-chat/adapters/dummy': () => import('@haeckmec/grounded-chat/adapters/dummy'),
  '@haeckmec/grounded-chat/http': () => import('@haeckmec/grounded-chat/http'),
  '@haeckmec/grounded-chat/client': () => import('@haeckmec/grounded-chat/client'),
  '@haeckmec/grounded-chat/react': () => import('@haeckmec/grounded-chat/react'),
  '@haeckmec/grounded-chat/admin': () => import('@haeckmec/grounded-chat/admin'),
  '@haeckmec/grounded-chat/admin-react': () => import('@haeckmec/grounded-chat/admin-react'),
  '@haeckmec/grounded-chat/eval': () => import('@haeckmec/grounded-chat/eval'),
};

describe('built package', () => {
  it.each(Object.entries(subpaths))('resolves %s', async (_name, load) => {
    expect(await load()).toBeTypeOf('object');
  });
});
