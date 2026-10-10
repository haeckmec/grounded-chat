# Build history

What each gate closed and the standing rules it taught. Newest at the bottom.

## 2026-10-10 · K0, SDK half
- Closed: private repo, npm workspaces with turbo, tsup with one entry per subpath (from ), vitest, eslint with purity, domain-word and no-console rules plus tests that they fire, changesets, ci.yml (Node 20 and 24), release.yml (tag check, gate, publish with GITHUB_TOKEN), .npmrc on NODE_AUTH_TOKEN.  on GitHub Packages; scratch install resolved every subpath.
- Standing rules learned: no  at the root (the CommonJS session-boot hook breaks under it); turbo writes AGENTS.md unless  is false.
