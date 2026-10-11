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

## 2026-10-11 · K3
- Closed: `IntakePlan` with `intakePromptLines`, `userWordsSchema`, `unstatedSlots`, `nextMissingSlot`, `applicableSlots`. The chatbot's four rating dimensions are its plan; prompt, tool schema, grounding, dummy questions and quick replies read it, and the golden transcripts (which record prompt and schema) are identical. 0.0.4. `runTurn` takes no policy (D-22).

## 2026-10-11 · K4
- Closed: `JudgeSpec` with pack-defined verdicts, `runJudge` and its steps, `defaultVerdicts`, `scoreReply`; `/eval` runners. The chatbot's judge wording is unchanged; a golden of every labelled item's request and of the reply parsing, recorded before the move, is identical (D-19). 0.0.5.
- Found: the import-only exports map broke the chatbot's `tsx` scripts from K1 on (CommonJS require). Every subpath now has a `default` condition; the example tests requiring the build.

## 2026-10-11 · K5
- Closed: `/client` (SSE reader, embed parsing, contrast, fonts) and `/react` (`useGroundedChat`, `ChatWidget` with renderer map and `className` slots, default stylesheet on CSS variables, `Playground`, `PlaygroundStats`). The UI takes the host's `fetch` (D-23). The chatbot passes its Tailwind classes into the slots: all 11 screens byte-identical, Playwright 5 of 5. `docs/ui-css-variables.md` is the UI standard. 0.0.6.

## 2026-10-11 · K6
- Closed: `/admin` handlers (config with ETag and If-Match, transcript, prune, stats), each refusing with 401 unless `authorize` returns true, tested five ways per handler; `ConfigStore` and its contract; `/admin-react` shell and panels through one class map. The chatbot's admin routes and three tabs run on them; screens byte-identical. 0.0.7.

## 2026-10-11 · K7
- Closed: `measureFigures` with streaming parity at every cut; `examples/grounded-kb` (tools, measures, one-slot plan, own verdict, server, widget, admin) as the second consumer of every kernel API; `npm run check:packed` runs it on the packed tarball outside the workspace, in CI and in the release workflow; the API review test (doc comment on every export, a test for every runtime export); quickstart, API notes, consumer notes. Guard tests copied from the chatbot rewritten with neutral figures and wording. No CLI in `/eval` (D-24). 0.1.0.
- Standing rules learned: a vendored bump is a hand-patched lockfile entry (version, resolved, integrity) to avoid npm-version churn; the example must declare every type package it uses, the packed check finds what workspace hoisting hides.

## 2026-10-11 · 0.1.0 published
- Closed: local gate on ac48938 green (9 of 9 turbo tasks, 255 package tests, 33 example tests, `check:packed`). Jan approved the one tag; `v0.1.0` pushed at ac48938. release.yml run 38145585303 passed in 57s (its own gate, `check:packed`, `npm publish`). `@haeckmec/grounded-chat` 0.1.0 is listed under GitHub Packages for the haeckmec user, published 14:03 UTC.
- Open: northstar-react still installs the vendored tarball (G-1). The shell that ran this had no `NODE_AUTH_TOKEN`, so the registry install waits for a shell that has it.
