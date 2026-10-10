# Build history

What each gate closed and the standing rules it taught. Newest at the bottom.

## 2026-10-10 · K0, SDK half
- Closed: private repo, npm workspaces with turbo, tsup with one entry per subpath (generated from `subpaths.ts`), vitest, eslint with purity, domain-word and no-console rules plus tests that they fire, changesets, `ci.yml` (Node 20 and 24), `release.yml` (tag check, gate, publish with `GITHUB_TOKEN`), `.npmrc` on `NODE_AUTH_TOKEN`. `0.0.1` is on GitHub Packages; a scratch install with a read:packages token resolved all 9 subpaths at runtime and in NodeNext types.
- Standing rules learned: no `"type": "module"` in the root `package.json` (the CommonJS session-boot hook breaks under it); turbo writes `AGENTS.md` unless `agentGuidance` is false in `turbo.json`.
