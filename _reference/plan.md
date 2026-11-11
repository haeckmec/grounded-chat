# Grounded chat SDK plan (K0 to K16)

The spec for this repo. Written in northstar-react (`_reference/General/grounded-chat-sdk-plan.md`) on 2026-10-10 and kept here as the source of truth; later changes happen in this file only. Decisions taken since are in `decisions.md` (D-10 onwards) and noted inline.

## Status

| Batch | State |
| --- | --- |
| K0, SDK half | Done 2026-10-10: repo, build, lint rules with tests, exports map, changesets, CI and release workflows, docs. `0.0.1` published by release.yml; a scratch install with a read:packages token resolved all 9 subpaths at runtime and in types |
| K0, northstar-react half | Done 2026-10-11: vendored tarball (D-17, G-1 waits for the registry pin), Vercel preview READY, 11-screen baseline |
| K1 to K7 | Done 2026-10-11 in one unattended run; 0.1.0. Detail in `build-history.md` |
| K8 to K16 | Planned 2026-11-11: eval releases 0.2 to 0.4, see "Eval roadmap" below. Not started |

The resume position lives in `execution-prompt.md`.

## Context

The chatbot in `apps/chatbot` works, but its grounding logic and its insurance quote flow are welded together. `handle-chat-turn.ts` (427 lines) runs the tool loop and also knows `get_quote`, `list_benefits`, households and `insuredKey`. `system-prompt.ts` hardcodes the question order ("destination country, then age, then who is covered, then cover basis"). `quote-grounding.ts` hardcodes the 4 dimensions. `judge-reply.ts` hardcodes "insurance quotation assistant". `amount-spans.ts` only knows money.

Jan wants three layers so other use cases can reuse the parts that make the chat trustworthy:

1. **Kernel**: LLM port and streaming, number guard, grounding check, judge, canaries, eval harness. Domain-free.
2. **Intake policy**: what to ask, in which order, when the answers are complete. Separate and swappable.
3. **Domain packs**: a quote chatbot (Quoteproof funnels, any priced product) and a grounded chatbot that does not quote (Jan's Back Bar "Ask Jan", M3, about **2026-11-14**).

Jan's answers (2026-10-10), not to be re-asked:
- **Home**: yes, a separate private repo shipped as an SDK makes sense, and it is what this plan does. Quoteproof and Jan's Back Bar both integrate it as consumers. Neither product owns it. (I found no earlier write-up of the SDK idea in `_reference/`, so this plan records it as decision 14 in `QUOTEPROOF-BUILD-PLAN.md` §9.)
- **Timing**: extract now, before F0, so back-bar M3 consumes it and F0/F2 build on it.
- **Intake for Quoteproof**: derived from the pricing model's inputs (F1), admin overrides per funnel.
- **Scope**: possibly a product later ("grounded chat SDK, pay attention"). The public API gets semver, docs and examples now. No public registry, docs site or pricing yet.

## Approach

### Repo and package

- New private repo `haeckmec/grounded-chat`, package `@haeckmec/grounded-chat` (working name), license `UNLICENSED`, ESM only, built with types.
- Published to GitHub Packages. Consumers pin an exact version. Changesets write the changelog. Versions stay 0.x until a second consumer (back-bar) ships on it, then 1.0.
- Subpath exports keep the core pure (no fetch, env or fs, same rule as `packages/*` here):
  - `@haeckmec/grounded-chat` : turn engine, guard, grounding, intake, judge, types.
  - `/adapters/gemini`, `/adapters/dummy` : LLM adapters (the only code that does network I/O).
  - `/http` : rate limit, origin check, message cap, token budget, client IP (from `src/server/guards/`).
  - `/client` : SSE reader (`src/lib/read-sse.ts`), embed parameter parsing (`embed-params.ts`), contrast helper (`contrast-color.ts`). No React, usable from any frontend.
  - `/react` : chat UI (see "Chat UI and admin" below). React 19 as a peer dependency.
  - `/admin` : server handlers for the generic admin functions, each behind an `authorize` callback the host app supplies.
  - `/admin-react` : the generic admin panels as React components.
  - `/eval` : judge-eval runner, latency runner, second-grader script, as library functions plus a small CLI.
- Storage is a port (`ChatStore`: sessions, messages, snapshots, usage) with an in-memory reference adapter. The libsql repos stay in `apps/chatbot` and implement it.
- Repo rules in its own `CLAUDE.md`: no domain words in `src/` (lint list: insurance, premium, quote, rate table, cocktail, bar, drink; "policy" dropped because the API itself uses it, D-11), every public export documented, synthetic fixtures only (no APRIL product data, rate tables or benefit copy ever enter the repo), tests and CI never call a real endpoint.
- Lint enforcement sits in `tooling/eslint-config` with its own tests (D-13): purity rules outside `src/adapters/` (no fetch, env, Node built-ins or `import.meta.env`, D-14), the domain-word rule and `no-console` across `src/`.
- `subpaths.ts` lists every subpath. The tsup entries come from it, a test ties it to the `exports` map, and `examples/grounded-kb` imports each subpath by its public name.

### The three layers as code

| Layer | Moves from | Becomes |
|---|---|---|
| Kernel: ports | `server/ports/llm.ts`, `llm-gemini-adapter.ts`, `llm-dummy-adapter.ts`, `llm-port-contract.ts` | `LlmPort`, `streamTurn`, adapters, the contract test exported for any new adapter |
| Kernel: guard | `src/guard/*` (amount-spans, number-strip, streaming-number-guard, leak-check, snapshot) | Same code, plus a `FigureClass` config: `money` (today's definition, the default) and `measure` (ml, cl, oz, dashes, parts, % ABV) for back-bar's "never invent specs or ratios". Replacement text comes from the pack, EN/FR defaults |
| Kernel: canaries | `server/prompts/canary.ts` | Canary generation and leak scoring, canary values supplied by the pack |
| Kernel: turn engine | the loop in `handle-chat-turn.ts`: tool rounds, 503 retry before first delta, tool results always back to the model, fallback, listeners, metrics, message cap, token budget | `runTurn({ llm, store, pack, policy, listeners, limits })`. Tools return `{ payload, authorizedFigures, snapshot? }`, so the guard learns what it may show from tool results only |
| Kernel: grounding | `unstatedDimensions` in `quote-grounding.ts` | `unstatedSlots(customerWords, customerMessages, slotIds)`: the check that each value the model passes was said by the user |
| Kernel: judge | `judge-reply.ts`, `score-attempt.ts` | Judge runner with pack-defined verdicts (name, definition, schema built from them). The 3 current verdicts ship as a reusable default set |
| Intake policy | the order in `GUARDRAILS`, `DIMENSION_NAMES`, the 4 `customerWords` keys in `tools.ts`, the order in `dummy-nlu.ts` | `IntakePlan`: ordered slots `{ id, label, askHint, required, when?, quickReplies? }` plus a completion tool. Compiles into the prompt section, the `customerWords` schema of the completion tool, the grounding slot list and the dummy adapter's order. A pack may have no plan (free Q&A) |
| Quote pack | `get_quote`, `list_benefits`, `compose-family-quote`, `narrate-quote`, `insuredKey`, `product-facts.ts`, `JUDGE_INSTRUCTIONS` wording, persona | Stays in `apps/chatbot` until F0, then becomes `packages/quote-agent` in Quoteproof, its `IntakePlan` derived from F1 inputs |
| Grounded pack (example) | nothing yet | `examples/grounded-kb` in the SDK repo: a synthetic knowledge base, a lookup tool, `measure` figures, an "unverified" label rule, its own judge verdict ("states an unverified item as fact"). Shaped like Ask Jan so back-bar M3 copies it as its start |

### Chat UI and admin: where each part lives

Today `ChatWidget.tsx` (673 lines) mixes a generic chat with the quote card, and `AdminPanel.tsx` (1013 lines) has 5 tabs, 3 of them generic. The split:

| Part | Today | Lives in | Why |
|---|---|---|---|
| Chat state and streaming | inside `ChatWidget.tsx` | SDK `/react`: `useGroundedChat()` hook (messages, streaming deltas, retry, rate-limit and error states, suggested replies) | Every consumer needs it, back-bar's phone UI included |
| Chat primitives | inside `ChatWidget.tsx` | SDK `/react`: message list, bubble, composer, quick-reply pills, typing state, a ready-made `<ChatWidget>` built from them | Styled only through CSS variables and `className` slots, no Tailwind in the package, so any app's design system can theme it (F3 branding feeds those variables) |
| Custom message renderers | the `quote` message type | SDK `/react` takes a renderer map per message type from the pack | The quote card is a renderer, not a widget feature |
| UI strings | `t` dictionary EN/FR in `ChatWidget.tsx` | Generic strings in the SDK with EN/FR defaults; domain strings from the pack | "Your indicative quote" is quote-pack copy |
| Quote card, profile humanizer, lead capture form | `ChatWidget.tsx` | Quote pack: `apps/chatbot` now, `packages/quote-agent/ui` after F0 | Quote-specific |
| Embed page | `app/embed/*` | Stays in each host app, built from `/client` embed parsing and `/react` | Routes belong to the host |
| Red-team playground | `app/playground/*`, `/api/playground/stats` | SDK `/react` `<Playground>` + `/eval` scoring + `/admin` stats handler; the page itself stays in the host | Every pack wants to attack its own bot |
| Admin: Conversation tab (disclaimer, fallback, handoff texts) | `AdminPanel.tsx`, `/api/admin/config` | SDK `/admin-react` + `/admin` | Generic |
| Admin: Model tab (model id, thinking level, token budget, message cap) | same | SDK | Generic |
| Admin: Compliance and theme tab | same | Split: theme and banned strings in the SDK, compliance copy from the pack | Theme is generic, compliance wording is not |
| Admin: transcripts, health, retention prune | `/api/admin/sessions`, `/health`, `/prune` | SDK `/admin` + `/admin-react` transcript viewer | Generic |
| Config validation, secret-shaped key refusal, localized text | `server/admin/config-schema.ts` | Generic schemas and `noSecretShapedKeys` in the SDK; pack fields extend them | Generic rule worth keeping everywhere |
| Admin: Data source tab (rate tables, template, activate) | `AdminPanel.tsx`, `/api/admin/rate-tables*` | Quote pack in `apps/chatbot`; after F0 the F1 pricing model replaces it inside Quoteproof's `apps/admin` | Pricing data is Quoteproof's |
| Admin: Leads tab | `/api/admin/leads` | Quote pack now; Quoteproof's `apps/admin` lead list after F0 | Lead capture belongs to the funnel |
| Admin auth | proxy and token in `apps/chatbot` | Always the host. The SDK never owns accounts; every `/admin` handler refuses unless the host's `authorize` returns true (deny by default) | Quoteproof has better-auth, back-bar has its own |

After the fork, Quoteproof mounts the SDK panels inside `apps/admin` per funnel next to its own pricing screens, and the funnel mounts the SDK widget with the quote pack's renderers. Back-bar uses `useGroundedChat()` with its own phone UI and mounts the transcript viewer and playground in its own admin if it wants them.

### Batches (pre-fork, before F0)

**K runs as one block: K0 to K7 back to back, and nothing else starts (no F0, no open N-items) until K7 publishes `0.1.0`.** Each batch still stops for Jan at its gate, per CLAUDE.md.

Each batch keeps `apps/chatbot` behaviour identical. Proof: its full suite unchanged, the streaming guard parity tests, and golden dummy-adapter transcripts recorded in K1 that every later batch must reproduce byte for byte.

| Batch | What | Plan-days |
|---|---|---|
| **K0** | Repo bootstrap: build, vitest, lint (incl. domain-word list), CI, changesets, publish workflow to GitHub Packages, `CLAUDE.md`, README skeleton. Publish `0.0.1` and install it in `apps/chatbot` on Vercel to prove registry auth end to end before any code moves. Take the screenshot baseline of the chatbot widget, embed, playground and every admin tab | 1 to 2 |
| **K1** | Move guard, canaries and ports. Add `FigureClass` with `money` as default (parity: money output identical on every existing test). Record golden transcripts in `apps/chatbot` first. `apps/chatbot` imports from the package; local copies deleted | 2 to 3 |
| **K2** | Turn engine and `ChatStore` port. `handle-chat-turn.ts` shrinks to the quote pack: tool executors, household composition, narration | 2 to 3 |
| **K3** | `IntakePlan`. The 4 dimensions become a plan in `apps/chatbot` code (F1 later derives it). Prompt, tool schema, grounding and dummy NLU read the plan | 1 to 2 |
| **K4** | Judge and eval. `JUDGE_INSTRUCTIONS` wording moves to the quote pack. Re-run the labelled set with the dev key: must stay **120 of 120**; a mismatch is investigated, never relabelled | 1 to 2 |
| **K5** | Chat UI: `/client`, `useGroundedChat()`, primitives and `<ChatWidget>` on CSS variables, renderer map, string dictionaries. The quote card moves to the quote pack as a renderer. `apps/chatbot` widget, embed and playground pages rebuilt on them. Proof: chatbot Playwright e2e green and `verify:screens` screenshots unchanged against the K0 baseline | 2 to 3 |
| **K6** | Admin: `/admin` handlers with `authorize`, `/admin-react` panels (Conversation, Model, theme, transcripts, playground stats), generic config schemas and `noSecretShapedKeys`. `AdminPanel.tsx` keeps only Data source and Leads and mounts the SDK panels for the rest. Same e2e and screenshot proof | 2 to 3 |
| **K7** | `measure` figure class, `examples/grounded-kb` (server, widget and admin, all on the dummy adapter), quickstart, API review (every export named, documented, tested, no APRIL data), `export-standalone` updated to depend on the package. Publish `0.1.0` | 1 to 2 |
| | **Total** | **12 to 20**, about 3 to 5 calendar days at the measured 4:1 |

### Dev loop across two repos

Day to day, `apps/chatbot` points at the local checkout through an npm `overrides` entry that is never committed. Commits only ever carry a pinned registry version. A kernel fix lands as: SDK commit, changeset, publish, bump in the consumer, consumer gate.

### Changes to `QUOTEPROOF-BUILD-PLAN.md` past the fork

- **§3 order**: `... P3 -> K grounded chat SDK -> F0 ...`.
- **§3b sizing**: add K at 12 to 20. F0's date holds, since prep closed about 5 weeks ahead of its **2026-11-15** estimate.
- **§6 F0**: the zero-imports rule still ends here. The chatbot already depends on the SDK as an external package, which never broke the rule. F0 also moves the quote pack out of `apps/chatbot` into `packages/quote-agent`.
- **§7 F1**: block 1 (inputs) carries intake metadata per input: order, ask hint, condition, and whether the user's own words are required. Exit adds: "the intake plan is generated from the model, with a golden test per synthetic product".
- **§7 F2**: replace "the playground's guard package becomes a shared package" with "the agent in the funnel and the admin runs on the grounded chat SDK: the funnel mounts the SDK widget with the quote pack's renderers, `apps/admin` mounts the SDK panels per funnel behind its better-auth `authorize`, and `packages/quote-agent` holds tools, facts, judge verdicts, the quote card and the F1-derived intake plan; admin overrides of the intake per funnel". Rate tables and the chatbot's own lead list retire in favour of the F1 pricing model and the funnel's leads. Size drops to 6 to 10.
- **§7 F3**: branding writes the SDK's CSS variables, so funnel and agent theme from one source.
- **§7 F5**: the SDK stays tenant-agnostic. Workspace scoping lives in the `ChatStore` adapter and the app.
- **§7 F6**: drafting calls models through the SDK's `LlmPort`.
- **§9**: decision 14, the SDK as its own private repo, product posture, Jan 2026-10-10.

Also updated in the same commit: `General/chatbot-architecture.md` (layers), `General/pre-fork-plan.md` (K after P3), `<resume_status>` (next: K0), `apps/chatbot/README.md` (new dependency and the registry token env var).

### Hint in jans-back-bar

Done on 2026-10-10, branch `claude/grounded-chat-sdk-hint` of `haeckmec/jans-back-bar` (merged to its default branch only on Jan's word):

- `_reference/plan.md`, at the top of M3: **M3 does not start until K7 publishes `@haeckmec/grounded-chat` 0.1.0.** M1, M2, M4 and M5 can go ahead. Then the integration basis:
  1. Add the package (exact version) and a `.npmrc` pointing `@haeckmec` at GitHub Packages; the read token is an env var, never committed.
  2. Start from the SDK's `examples/grounded-kb`: it is shaped like Ask Jan.
  3. Pack: tools that call `packages/bar-core` and `packages/kb` (shelf, makeable, substitution, twist lookups), `authorizedFigures` from KB results only, the `measure` figure class for specs and ratios, persona from `docs/ask-jan-voice.md`, judge verdicts for the must-nevers (a drink suggested without naming what is missing, disputed history stated as fact, an unverified KB item stated as fact), the "untested riff" label as a pack rule.
  4. No intake plan, or a one-slot plan ("what is on your shelf?"), since Ask Jan answers questions rather than collecting a quote.
  5. Server: `runTurn` with the Gemini adapter (decision D-4) and a `ChatStore` adapter on back-bar's own storage; `/http` guards for message cap, token budget and rate limit.
  6. UI: `useGroundedChat()` under back-bar's own phone-first UI; the ready-made widget is optional.
  7. Admin, if wanted: mount the transcript viewer and playground behind back-bar's own auth via `authorize`.
  8. Tests on the dummy adapter; a labelled set for its verdicts through `/eval`.
- `CLAUDE.md`: the candidate playbooks `grounded-chat.md` and `ports-and-mocks.md` point at the SDK and `examples/grounded-kb` instead of `quote-chatbot-standalone/src/server/guards`.

K7 refreshes that note with the real export names once the API review settles them.

## Eval roadmap: 0.2 to 0.4 (K8 to K16)

Agreed with Jan on 2026-11-11, after an audit of the SDK against standard eval practice (claude.ai doc "Grounded chat SDK and evals", section "SDK eval audit"). The judge already lives here; what Jan's Back Bar built around it (live sampling, a failure report, a rule grader for CI) moves in, then the gaps the audit found close in 2 more minor releases. Every release is additive: no export is renamed or removed (non-negotiable 4), so consumers move by bumping their exact pin.

### Why, in one line per release

| Release | Closes | Who needs it first |
| --- | --- | --- |
| **0.2 "Eval ops"** | Judge reasons thrown away; agreement without rates or kappa; live sampling and failure report only in Back Bar; no rule grader or CI threshold in the SDK | The portfolio's Ask Jan: badge and live grading before its dry run on **6 Dec** |
| **0.3 "Scenario evals"** | No end-to-end runner through `runTurn`; one run per item; no results format; no held-out split | The portfolio's eval playground (recorded runs), Quoteproof's regression gate |
| **0.4 "Independence"** | Gemini is the only grader family; no path from transcripts to labelled items; no red-team set | Every consumer; can wait until January |

### Batches

Each batch is one session in this repo, gated by `npx turbo run typecheck lint build test`, with tests for every new export, a doc comment on each (rule 6) and the grounded-kb example using it. Effort in hours of Claude Code time.

| Batch | Release | What | New or changed exports | Gate criteria | Effort |
| --- | --- | --- | --- | --- | --- |
| **K8** | 0.2 | Judge reasons. The parser keeps the one-sentence reason the judge already returns, per verdict | `runJudgeDetailed()` returning `{ verdicts, reasons } \| null`; `parseJudgeReplyDetailed()`; type `JudgeResult`. `runJudge` and `parseJudgeReply` unchanged | Existing judge tests unchanged; a reply without reasons parses to empty reasons, never to null | 1 h |
| **K9** | 0.2 | Agreement statistics | `AgreementReport` gains per verdict `truePositiveRate`, `trueNegativeRate`, `kappa` (Cohen's) and `lowSupport` (true when a verdict has fewer than `minFailing` labelled failures, default 5) | Rates and kappa match hand-computed fixtures, including the all-pass and all-fail edge cases (kappa undefined, reported as null) | 1 to 1.5 h |
| **K10** | 0.2 | Live sampling, lifted from Back Bar `judge-sample.ts` and renamed domain-free | `createJudgeSampler({ rate, random, judge, store })` returning `maybeGrade(turn)`; port `SampleStore` (`save`, `list`); `inMemorySampleStore()`; `sampleStoreContractCases()` (framework-free, D-20); `fallbackLlm([ports])` that moves to the next port on 429 or 503 | Rate 0 never calls the judge; rate 1 always does; a judge failure stores an ungraded sample, never a pass; contract cases pass on the in-memory store; no `env`, `fetch` or `fs` (the host reads its rate from env) | 2 h |
| **K11** | 0.2 | Failure report, rule grader, CI threshold | `failuresByVerdict(samples)` (from Back Bar `judge-report.ts`); `ruleGraderPort(rules)`, an `LlmPort` that answers in the judge's JSON from rule functions, so CI runs the whole judge path without a model; `assertThresholds(report, { minAgreement, maxFailureRate, verdicts? })` that throws one readable message listing every breach | Rule grader passes the judge's own schema parser; thresholds fail on a crafted report and pass on a clean one; grounded-kb runs a rule-graded eval in its test | 2 h |
| **R0.2** | 0.2 | Release | Changeset (minor, "additive: eval ops"), API review of the new exports, docs page `docs/evals.md` (sampling, report, rule grader, thresholds). Ask Jan, then tag `v0.2.0` | Packed tarball installs in grounded-kb; release.yml green | 0.5 h |
| **K12** | 0.3 | Results format | `EvalRun` type and `createEvalRun()`: run id, date, SDK version, model ids, prompt hash, dataset hash, per-item results and grades; `hashText()` on Web Crypto (allowed in the core: no `fetch`, `env` or `fs`). Serialising stays pure; hosts write the file | Two runs of the same inputs give the same hashes; a changed prompt changes the prompt hash only | 1.5 h |
| **K13** | 0.3 | Scenario runner | `runScenarios({ scenarios, makeTurn, judge?, trials })`: scripted user turns through `runTurn` on any `LlmPort`, each reply scored with `scoreReply` and, when given, the judge; returns an `EvalRun`. Type `Scenario` (turns, expected verdicts, tags) | On the dummy adapter the run is byte-identical across 2 runs; a scenario with a leaked figure is scored "held" | 3 to 4 h |
| **K14** | 0.3 | Repeated trials and splits | `trials: k` on `runScenarios`; per scenario `passAtK` and `passPowK` (passes every time); `splitItems(items, { heldOut, seed })`, deterministic by hashed id; `agreement` reported per split | pass^k is 1 only when every trial passes; the split is stable across runs and machines | 2 h |
| **R0.3** | 0.3 | Release | Changeset, docs (`docs/evals.md`: scenarios, trials, splits, results file), ask Jan, tag `v0.3.0` | As R0.2 | 0.5 h |
| **K15** | 0.4 | Second model family | New adapter subpath (`./adapters/anthropic` if Jan confirms the family; lifts D-9) in `subpaths.ts`, `exports` and the subpaths test in one commit (rule 12); key from env only; its real-model script refuses under `CI` or `VERCEL`. `compareGraders(a, b, items)` returns agreement between 2 graders | `llmPortContractCases()` pass on the new adapter with a stubbed fetch; no test calls a real endpoint | 2 to 3 h |
| **K16** | 0.4 | Error analysis and red team | `transcriptToEvalItem(transcript, labels)` from a `ChatStore` transcript; docs page on the loop (read 20 to 50 transcripts, note the first failure, group, label); a synthetic red-team set in `examples/grounded-kb` (prompt injection, instruction leaks, figure baiting, off-topic pressure) with expected verdicts | The red-team set runs through `runScenarios` on the dummy adapter in the example's test; no real data in fixtures (rule 3) | 2 to 3 h |
| **R0.4** | 0.4 | Release | Changeset, docs, ask Jan, tag `v0.4.0` | As R0.2 | 0.5 h |

Totals: 0.2 about 6.5 to 7 h, 0.3 about 7 to 8 h, 0.4 about 5 to 6.5 h.

### Order and dates

- **0.2 first, in the week of 24 Nov**, as 2 evening sessions (K8 and K9, then K10, K11 and R0.2). The portfolio's Ask Jan needs it before its dry run on 6 Dec.
- **0.3 after the portfolio's soft launch (14 Dec)**, unless the eval playground is pulled forward. Until then the playground runs from recorded files written by a host script, as Back Bar does today.
- **0.4 in January.**
- **Risk:** 0.2 lands in the same weeks as the portfolio shell build (21 Nov to 5 Dec). Fallback: ship K8 to K10 as 0.2.0 and move K11 to 0.2.1; the portfolio can gate CI on its own threshold check for 2 weeks.

### Consumer adoption (in their own repos, after each release)

| Consumer | After | Change | Proof |
| --- | --- | --- | --- |
| jans-back-bar | 0.2 | Replace `server/ask-jan/judge-sample.ts`, `judge-report.ts` and the rule-grader plumbing with the SDK exports; `judge_samples` becomes its `SampleStore`; bar words stay in the pack | Its judge tests unchanged; live sampling still writes one turn in ten |
| northstar-react (Quoteproof) | 0.2 | Live sampling on the chatbot; the 120-verdict set stays the regression gate, now through `assertThresholds` | 120 of 120 unchanged |
| portfolio (Ask Jan) | 0.2, then 0.3 | Ask Jan on the SDK from the start; its 50-question set and `/eval` runner replace promptfoo; verdicts: the 3 defaults plus `jobSearchSignal`, `confidentialDetail`, `uncited`, `wrongLanguage`; grade every live turn while traffic is low; the eval playground reads `EvalRun` files from 0.3 | "Passed N of 50" badge from a recorded run |

### Not built in 0.2 to 0.4

- An admin panel for samples (`admin-react` judge tab). Back Bar keeps its own until a second consumer asks; candidate for 0.5.
- A CLI or hosted dashboard (D-24 stands: library functions only).
- Automatic relabelling: a judge disagreement is investigated, never relabelled.

### Risks

- **Bar words leak in with the lifted code** (likely, since the sources come from Back Bar). The domain-word lint fails the gate; K10 and K11 include a rename pass.
- **Kappa misread on tiny sets.** Back Bar has about 30 failing labels across 8 verdicts. `lowSupport` flags any verdict under 5 failures, and docs say so.
- **A breaking change slips in.** Every change adds; the API review in each release checks for removed or renamed exports.
- **Free-tier quotas** slow real-model runs. Real runs stay scripts outside CI; the rule grader keeps CI model-free.

### Decision gates for Jan

- The second model family for K15 (Claude, which lifts D-9, or another) and who pays for its key.
- Each tag (`v0.2.0`, `v0.3.0`, `v0.4.0`): publishing is outward.
- Pulling 0.3 forward before 14 Dec, if the portfolio's eval playground needs live recorded runs at the soft launch.

## What Jan does

0. Merge the back-bar hint branch when ready.
1. ~~Create the private repo `haeckmec/grounded-chat`~~. Done on 2026-10-10 by the basecamp session with `gh repo create`.
2. Create a GitHub Packages read token and set it as a secret in GitHub Actions and as an env var on the chatbot Vercel project. It never goes into a repo.
3. For the local scratch install: `gh auth refresh -s read:packages`, so the session can read the package with the gh token from env.

## Not built

- Quote card, rate tables, lead capture, the Data source and Leads admin tabs: quote pack.
- Accounts and auth: always the host's.
- A database driver: consumers implement `ChatStore`.
- A Claude adapter: out until asked (D-9).
- A public registry, docs site or pricing: not until the product posture changes.
- A Next.js app, Playwright or `verify:screens` in this repo: screens are verified in the consumers (D-12).

## Risks

- **Registry auth blocks a deploy** (I think about 30% on the first try, Vercel and private registries often need a `.npmrc` tweak). K0 proves it with an empty package before any code moves. Fallback: a vendored tarball (`npm pack`) as a `file:` dependency, about 1 hour.
- **Wrong abstraction from one consumer.** Every kernel API must serve both the quote pack and `examples/grounded-kb` in tests. If an API only fits one of them, it stays in that pack.
- **Behaviour drift during the move.** Golden transcripts, guard parity and the judge's 120 of 120 catch it. A golden mismatch stops the batch.
- **IP leakage into a sellable repo.** Domain-word lint, synthetic fixtures only, and K7's API review reads every file once for APRIL data.
- **Visual regression in the chatbot widget or admin** while moving off Tailwind classes (I think **40%** that K5 needs a second pass on at least one screen). Screenshot baseline from K0; a changed screenshot stops the batch until it matches or Jan accepts it.
- **Admin auth gap in a host app.** Handlers refuse without `authorize`; a test per handler proves the refusal.
- **Free-tier key (N-118)** makes the K4 eval re-run slow (15 requests a minute). The dev key's pause flag handles it; it costs time, not correctness.

## Three-reviewer critique

**Round 1**
- *Senior engineer*: one real consumer makes a wrong turn engine likely. Fixed: the grounded-kb example as a second consumer in tests. Cross-repo iteration is slow. Fixed: uncommitted `overrides` for local work. Registry auth is untested. Fixed: K0 publishes and deploys an empty package first. The guard only knows money while back-bar needs measures. Fixed: `FigureClass`, money parity proven.
- *CEO*: 8 to 14 days of plumbing with no client. Answer: prep closed 5 weeks early so F0's date holds, back-bar gets its chat nearly free, and the SDK is a second sellable asset. Product polish now would be waste. Fixed: 0.x, README and 2 examples, nothing more.
- *Day one user* (a developer adding grounded chat to an app): "Can I get it running in an hour, and what do my users see when the guard fires?" Fixed: quickstart in K5, replacement text from the pack with EN/FR defaults. "Am I tied to Gemini?" No: `LlmPort`, a dummy adapter and an exported contract test for any new adapter.

**Round 2**
- *Senior engineer*: persistence was unowned. Fixed: `ChatStore` port, libsql stays in the app. The standalone export would break. Fixed: K5 updates it.
- *CEO*: no objection.
- *Day one user*: "How do I know my pack is safe?" Fixed: `/eval` runs a labelled set against the pack's verdicts.

**Round 3 (after adding UI and admin)**
- *Senior engineer*: shipping Tailwind-styled components in a package breaks any host without Tailwind and fights its design system. Fixed: CSS variables and `className` slots only, no Tailwind in the package. Moving the widget risks visual regressions. Fixed: screenshot baseline in K0, compared in K5 and K6. An admin handler in a library is an auth hole if a host forgets to wire auth. Fixed: every handler requires `authorize` and refuses without it, tested.
- *CEO*: the admin panels and widget turn plumbing into something a client can see, which is what makes an SDK sellable. Cost rises by 4 to 6 plan-days; prep's 5-week lead still covers it.
- *Day one user*: "Can I drop the admin into my own admin with my own login?" Yes, panels take a fetcher and handlers take `authorize`. "Must I use the ready-made widget?" No, `useGroundedChat()` works with any UI.

**Round 4**: no new findings from any reviewer. Approved.

## Verification

- SDK repo: `npx turbo run typecheck lint build test` green on Node 20 and 24 in CI; the lint-rule tests prove the purity and domain-word rules fire; `examples/grounded-kb` resolves every subpath; domain-word lint green; the adapter contract test passes against the dummy adapter; `examples/grounded-kb` runs its scripted conversation on the dummy adapter.
- `apps/chatbot` after each batch: full chatbot suite unchanged, golden transcripts identical, streaming guard parity tests green, then the repo gate from the root (`npx turbo run typecheck lint build test`, then `node scripts/comments/cli.mjs check --new HEAD`).
- K4: `scripts/judge-eval.ts` on `fixtures/judge-eval.json` with the dev key, 120 of 120.
- K5 and K6: chatbot Playwright e2e green, `npm run verify:screens` screenshots compared with the K0 baseline, every `/admin` handler's refusal test green.
- K0 and K7: Vercel preview of `apps/chatbot` builds with the package from the registry; live smoke on the preview (one quote conversation, one leak attempt, one off-topic attempt).
