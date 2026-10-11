# Execution prompt: grounded-chat

Paste-ready start for a build session. Read `CLAUDE.md`, `_reference/methodology.md` and `_reference/architecture.md` first. This file owns K progress; northstar-react's resume block only points here.

<resume_status>
Batch: none. K0 to K7 built 2026-10-11 and merged to main (ac48938)
Gate: closed. 0.1.0 published 2026-10-11: v0.1.0 tagged at ac48938, release.yml run 38145585303 green, package listed under GitHub Packages
Last closed: K7 (measure figures, grounded-kb example on the packed tarball, API review, docs, 0.1.0)
Next: northstar-react G-1 (registry pin), G-2 (root gate), G-3 (live judge), G-4 (e2e race). Back-bar M3 may start on 0.1.0
</resume_status>

## Where each batch runs

| Batch | Session started in | Code lands in | Proof runs in |
| --- | --- | --- | --- |
| K0 SDK half | this repo | this repo | this repo: CI, publish, scratch install. Done |
| K0 northstar half | `merlyon-funnel` (northstar-react) | northstar-react: `.npmrc`, pinned dependency, CI env | Vercel preview of `apps/chatbot`; screenshot baseline |
| K1 to K6 | `merlyon-funnel`, with `claude --add-dir ../grounded-chat` (or `/add-dir` in VS Code) | both: code moves out of `apps/chatbot` into this package, the chatbot imports it | this repo's gate, then the chatbot suite, guard parity and golden transcripts in northstar-react |
| K7 | this repo | this repo | this repo's gate plus `examples/grounded-kb` on the packed tarball |

Local paths: this repo is `C:\DATEN\Vibecoding\Claude\Code\grounded-chat`, northstar-react is `C:\DATEN\Vibecoding\Claude\Code\merlyon-funnel`. jans-back-bar only waits for `0.1.0` (its M3).

## K0, northstar-react half

1. Root `.npmrc` in northstar-react: `@haeckmec:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`. Never a literal token.
2. Pin `@haeckmec/grounded-chat` at exactly `0.0.1` in `apps/chatbot`. Nothing imports it yet.
3. CI hands `NODE_AUTH_TOKEN` from the Actions secret to `npm ci`. (I think granting northstar-react read access in the package settings and using `GITHUB_TOKEN` also works; try it if the secret is missing.)
4. A Vercel preview of `apps/chatbot` builds with the package from the registry. That closes G-1 here. Fallback: an `npm pack` tarball as a `file:` dependency, about 1 hour.
5. Screenshot baseline with `verify:screens`: chatbot widget, embed, playground and every admin tab. K5 and K6 compare against it.
6. Update both resume blocks (this file and northstar-react's `_reference/claude-code-execution-prompt.md`), close G-1 in `gaps.md`, close K0 in `build-history.md`.

Locally, `npm install` in northstar-react needs the token too: a user env var `NODE_AUTH_TOKEN`, or `NODE_AUTH_TOKEN="$(gh auth token)"` per command (the gh login has `read:packages`).

## Cross-repo loop (K1 to K6)

- Iterate with an npm `overrides` entry in northstar-react pointing at the local package. Never commit it.
- An SDK change lands as: commit here, changeset, version and tag (ask Jan before the tag, it publishes), bump the exact pin in northstar-react, its gate.
- Each batch commits to both repos separately, with the batch named in both commit messages.

## Batches

| Batch | Goal | Gate criteria | Status |
| --- | --- | --- | --- |
| K0 | Repo, build, lint, CI, release; `0.0.1` installed from the registry by `apps/chatbot` on Vercel; screenshot baseline | SDK gate green on CI; scratch install resolves every subpath; Vercel preview builds; baseline taken | Done (vendored tarball, D-17; G-1 waits) |
| K1 | Guard, canaries, LLM ports and adapters; `FigureClass` with `money` default | Golden transcripts recorded first and identical after; guard parity green | Done, 0.0.2 |
| K2 | `runTurn` and the `ChatStore` port | `apps/chatbot` suite unchanged, golden transcripts identical | Done, 0.0.3 |
| K3 | `IntakePlan` | Prompt, tool schema, grounding and dummy NLU read the plan; golden transcripts identical | Done, 0.0.4 |
| K4 | Judge runner, eval runners | Labelled set 120 of 120 | Done, 0.0.5 (golden proof, D-19; live re-run G-3) |
| K5 | `/client`, `/react` chat UI | Chatbot e2e green; screenshots match the K0 baseline | Done, 0.0.6 |
| K6 | `/admin`, `/admin-react` | Refusal test per handler; screenshots match the baseline | Done, 0.0.7 |
| K7 | `measure`, `examples/grounded-kb`, quickstart, API review, `0.1.0` | Example runs on the packed tarball; every export documented and tested; no APRIL data | Done, 0.1.0 |

## How to run a gate

1. Check the current code for the area, in both repos where the batch touches both.
2. Restate goal and files; wait for Jan's confirmation (skip when started with `/summit`).
3. Commit by commit, gate before each commit.
4. At gate close: update `<resume_status>` here and the pointer in northstar-react, append to `build-history.md`, run `/logbook`, stop.
