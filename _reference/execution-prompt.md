# Execution prompt: grounded-chat

Paste-ready start for a build session. Read `CLAUDE.md`, `_reference/methodology.md` and `_reference/architecture.md` first.

<resume_status>
Batch: K0 (repo bootstrap). SDK half closed 2026-10-10; northstar-react half open
Gate: K0 open until the northstar-react half lands
Last closed: K0 SDK half (CI green on main, 0.0.1 on GitHub Packages, scratch install resolved all 9 subpaths at runtime and in NodeNext types)
Next: in northstar-react, install 0.0.1 in apps/chatbot, prove the Vercel preview build with NODE_AUTH_TOKEN (closes G-1), take the screenshot baseline of widget, embed, playground and admin tabs. Then K1
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
