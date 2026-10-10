import { defineConfig } from 'tsup';
import { SUBPATHS } from './subpaths.js';

// One entry per subpath export, so each subpath ships as its own module and a
// consumer importing the core never loads React or an adapter.
const entry = Object.fromEntries(
  SUBPATHS.map((subpath) => [subpath === '.' ? 'index' : `${subpath.slice(2)}/index`, `src/${subpath === '.' ? '' : `${subpath.slice(2)}/`}index.ts`]),
);

export default defineConfig({
  entry,
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: true,
  treeshake: true,
  external: ['react', 'react-dom'],
});
