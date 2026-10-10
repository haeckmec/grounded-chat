# Plan: K0 to K7

K runs as one block, K0 to K7 back to back. Nothing else starts in northstar-react (no F0, no open N-items) until K7 publishes `0.1.0`. Each batch stops for Jan at its gate.

| Batch | Where | What | Plan-days |
| --- | --- | --- | --- |
| K0 | SDK, then northstar-react | SDK: repo, build, lint, CI, changesets, release workflow, publish `0.0.1` and install it from the registry. Then in northstar-react: install `0.0.1` in `apps/chatbot`, prove the Vercel build with the registry token, take the screenshot baseline of widget, embed, playground and admin tabs | 1 to 2 |
| K1 | both | Guard, canaries, LLM ports and adapters move. `FigureClass` with `money` as default, output identical. Golden dummy-adapter transcripts recorded in `apps/chatbot` first | 2 to 3 |
| K2 | both | Turn engine `runTurn(...)` and the `ChatStore` port. `handle-chat-turn.ts` shrinks to the quote pack | 2 to 3 |
| K3 | both | `IntakePlan`: compiles into the prompt section, the completion tool's `customerWords` schema, the grounding slot list and the dummy adapter's order | 1 to 2 |
| K4 | both | Judge runner with pack-defined verdicts, eval runners. The labelled set stays at 120 of 120 | 1 to 2 |
| K5 | both | Chat UI: `/client`, `useGroundedChat()`, primitives, `<ChatWidget>`, renderer map, EN/FR string defaults. Screenshots match the K0 baseline | 2 to 3 |
| K6 | both | Admin: handlers with `authorize`, panels (Conversation, Model, theme, transcripts, playground stats), generic config schemas with secret-shaped key refusal | 2 to 3 |
| K7 | SDK | `measure` figure class (ml, cl, oz, dashes, parts, % ABV), `examples/grounded-kb` complete, quickstart, API review, publish `0.1.0`, refresh the back-bar M3 note with real export names | 1 to 2 |
| | | **Total** | **12 to 20** |

Every batch keeps `apps/chatbot` behaviour identical: its suite unchanged, guard parity green, golden transcripts byte for byte.

## Not built

- Quote card, rate tables, lead capture and the Data source and Leads admin tabs: they stay in the quote pack.
- Accounts and auth: always the host's.
- A database driver: consumers implement `ChatStore`.
- A Claude adapter: out until asked (D-9).
- A public registry, docs site or pricing: not until the product posture changes.

## Verification

- SDK: the gate green; domain-word lint green; the adapter contract test passes against the dummy adapter; `examples/grounded-kb` runs its scripted conversation on the dummy adapter.
- `apps/chatbot` after each batch: full suite unchanged, golden transcripts identical, guard parity green, then its repo gate.
- K4: the judge eval on the labelled set with the dev key, 120 of 120.
- K5 and K6: chatbot Playwright e2e green, `verify:screens` screenshots compared with the K0 baseline, every `/admin` refusal test green.
- K0 and K7: a Vercel preview of `apps/chatbot` builds with the package from the registry; live smoke on the preview.
