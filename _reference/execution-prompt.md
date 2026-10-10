# Execution prompt: grounded-chat

Paste-ready start for a build session. Read `CLAUDE.md`, `_reference/methodology.md` and `_reference/architecture.md` first.

<resume_status>
Batch: K0 (repo bootstrap), SDK half in progress
Gate: K0 open. SDK half done when CI is green on main, 0.0.1 is on GitHub Packages and a scratch install resolves every subpath
Last closed: none
Next: publish 0.0.1 (ask Jan first), scratch install with a read:packages token; then the northstar-react half of K0 (install 0.0.1 in apps/chatbot, Vercel build, screenshot baseline, close G-1)
</resume_status>

## Batches

| Batch | Goal | Gate criteria | Status |
| --- | --- | --- | --- |
| K0 | Repo, build, lint, CI, release; `0.0.1` installed from the registry by `apps/chatbot` on Vercel; screenshot baseline | SDK gate green on CI; scratch install resolves every subpath; Vercel preview builds; baseline taken | Open |
| K1 | Guard, canaries, LLM ports and adapters; `FigureClass` with `money` default | Golden transcripts recorded first and identical after; guard parity green | Not started |
| K2 | `runTurn` and the `ChatStore` port | `apps/chatbot` suite unchanged, golden transcripts identical | Not started |
| K3 | `IntakePlan` | Prompt, tool schema, grounding and dummy NLU read the plan; golden transcripts identical | Not started |
| K4 | Judge runner, eval runners | Labelled set 120 of 120 | Not started |
| K5 | `/client`, `/react` chat UI | Chatbot e2e green; screenshots match the K0 baseline | Not started |
| K6 | `/admin`, `/admin-react` | Refusal test per handler; screenshots match the baseline | Not started |
| K7 | `measure`, `examples/grounded-kb`, quickstart, API review, `0.1.0` | Example runs on the packed tarball; every export documented and tested; no APRIL data | Not started |

## How to run a gate

1. Check the current code for the area, in both repos where the batch touches both.
2. Restate goal and files; wait for Jan's confirmation (skip when started with `/summit`).
3. Commit by commit, gate before each commit.
4. At gate close: update `<resume_status>`, append to `build-history.md`, run `/logbook`, stop.
