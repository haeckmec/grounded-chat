# Build history

What each gate closed and the standing rules it taught. Newest at the bottom.

## 2026-10-10 · K0, SDK half
- Closed: private repo, npm workspaces with turbo, tsup with one entry per subpath (generated from `subpaths.ts`), vitest, eslint with purity, domain-word and no-console rules plus tests that they fire, changesets, `ci.yml` (Node 20 and 24), `release.yml` (tag check, gate, publish with `GITHUB_TOKEN`), `.npmrc` on `NODE_AUTH_TOKEN`. `0.0.1` is on GitHub Packages; a scratch install with a read:packages token resolved all 9 subpaths at runtime and in NodeNext types.
- Standing rules learned: no `"type": "module"` in the root `package.json` (the CommonJS session-boot hook breaks under it); turbo writes `AGENTS.md` unless `agentGuidance` is false in `turbo.json`.

## 2026-10-11 · K0, northstar-react half
- Closed: `apps/chatbot` depends on the package as a vendored tarball (D-17), root `.npmrc` and every CI `npm ci` carry `NODE_AUTH_TOKEN` for the later registry pin, `verify:screens` for the chatbot with a checked-in baseline of 11 screens (widget empty, French, quote card; embed plain and themed; playground; five admin tabs). Vercel preview of the K0 commit READY.
- Standing rules learned: patch `package-lock.json` by hand for a vendored version bump (`npm install` with the container's npm 10.9 rewrites `devOptional` flags across the file); the standalone export needs npm 11 locally (npm 10.9 fails on `edgesOut`, unrelated to the package); `pkill -f` with a pattern that appears in the shell command kills the shell itself.

## 2026-10-11 · K1
- Closed: figure guard (`FigureClass`, `moneyFigures` default, pack replacement text), `createCanaries`, `LlmPort`, `streamTurn`, `LlmProviderError`, framework-free `llmPortContractCases` (D-20), Gemini and scripted dummy adapters. Golden transcripts recorded in the chatbot first (8 conversations, every request, delta and result) and identical after; the chatbot keeps its guard tests against the package (D-21). 0.0.2.

## 2026-10-11 · K2
- Closed: `runTurn` with `TurnPack` hooks, `ChatStore` with `InMemoryChatStore` and `chatStoreContractCases` (the chatbot's libsql repo passes it), `/http` guards on Web `Request`/`Response`, sweep throttle. Chatbot turn suite unchanged, golden transcripts identical, 11 screens byte-identical. 0.0.3.
- Northstar root gate: 35 of 36 tasks green; `api#test` fails only where a PDF renders, for want of Playwright's pinned headless shell in the container (G-2). K touches no api code.
