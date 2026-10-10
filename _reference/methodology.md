# Methodology: full mode

How this repo is built. Full mode because a wrong figure in a consumer's chat is the failure this SDK exists to prevent, and two apps consume it from the start (D-10).

## When to go back to light

Only when every trigger below is gone. Run `/altitude light`.
- Real users other than Jan and friends, or anyone pays (the SDK may be sold).
- The code handles other people's personal data beyond a name.
- More than one app depends on it.
- Money, pricing or other figures where a wrong answer has a cost.

## Batches and gates

- Work runs as batches K0 to K7 (`plan.md`). Each batch closes at a gate: the full gate passes, the consumer side is green where the batch touches it, and Jan confirms.
- Before a batch: check the current code for the area in both repos (never plan from memory of an earlier batch), restate the goal and the files, wait for confirmation.
- Inside a confirmed batch, go commit to commit without asking. `/summit` runs a whole batch.
- At gate close: update the resume block in `execution-prompt.md`, append to `build-history.md`, summarise, stop.

## Stops

Stop and ask (one AskUserQuestion: options, trade-offs, recommendation) when:
- The gate is red after 3 fix attempts.
- The next step is irreversible or outward: a publish, a pushed tag, a force push, a deleted package version.
- The next step costs money.
- The work deviates from `plan.md` or `execution-prompt.md`.
- An API shape only fits one consumer (see "Wrong abstraction" in `architecture.md`).

Everything else: pick the sensible default, log it in `decisions.md`, keep going.

## Gate

- Iterating: `npx turbo run typecheck lint` plus the unit tests touched.
- Before every commit: `npx turbo run typecheck lint build test` from the root. `--affected` runs never authorise a commit.
- Before a publish: the above, plus `examples/grounded-kb` builds and runs its scripted conversation on the dummy adapter against the packed tarball (`npm pack`).
- Consumer side, per batch: `apps/chatbot` suite unchanged, guard parity green, golden transcripts byte for byte. A golden mismatch is investigated, never updated to match.

A green gate doesn't prove skipped suites ran: read the skip count.

## Rules

1. **Ports and mocks.** Every external service (LLM, storage) sits behind a port with a mock or in-memory adapter. Tests use the mock.
2. **Contract tests on ports.** Each port has a contract test, exported so any new adapter runs it unchanged. The dummy adapter passes it in this repo; the Gemini adapter runs it only behind an explicit opt-in that refuses under `CI` or `VERCEL`.
3. **Golden cases** for anything with figures: a fixed input with a fixed expected output, checked in.
4. **Two consumers per kernel API.** Every kernel API is exercised by the quote pack (in `apps/chatbot`) and by `examples/grounded-kb`. An API that fits only one stays in that pack.
5. **Exports are append-only.** An export or config field is added and deprecated, never renamed. A removal is a breaking changeset.
6. **Fix the pattern.** When you fix one bug, search for the same pattern and fix it in the same commit.
7. **Gaps have IDs.** Every known issue goes into `gaps.md` with a stable ID and a status. Search before filing.
8. **Logs to files.** Diagnostics write to `.logs/` (gitignored), never `console.*`.
9. **Subagents are read-only.** Explore subagents do blast radius, pattern audit and diff review only.
10. **Expensive fixtures are built once per file**, deep-frozen so a mutation throws.

## Code graph (graphify)

Not set up. Add it when the repo passes about 300 source files.

## UI

The SDK ships unstyled components themed through CSS variables and `className` slots (D-7). Screens are verified in the consumers: `apps/chatbot`'s Playwright e2e and `verify:screens` against the K0 baseline. A UI standard for the package's own CSS variable names is written in K5.

## Data

No database driver in the package. Storage is the `ChatStore` port with an in-memory adapter; each consumer implements it on its own storage.

## Resume state

- `execution-prompt.md`: the `<resume_status>` block, position only. Edit it when a gate opens or closes.
- `build-history.md`: what each gate closed, standing rules learned.
- `gaps.md`: open and closed gaps. IDs never change.

## Model

Opus by default. Sonnet for mechanical batches (docs, renames, test scoping).
