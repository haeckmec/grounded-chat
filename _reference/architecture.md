# Architecture

A private TypeScript SDK for grounded chat: an LLM chat that only states figures and facts the host app's own tools returned, refuses guesses, and proves it with a judge and evals. It is extracted from `apps/chatbot` in northstar-react, where it runs live (`northstar-chatbot.vercel.app`) as an insurance quote chatbot.

**Consumers:** Quoteproof (northstar-react today, the forked repo after F0) and Jan's Back Bar (`haeckmec/jans-back-bar`; its M3 "Ask Jan" waits for `0.1.0`).

**Posture:** possibly sold later. Semver, a changelog, documented exports and examples from day one. No public registry, docs site or pricing yet.

## Failure modes, worst first

| Failure | What prevents it |
| --- | --- |
| A consumer's chat shows a figure no tool returned | One figure definition shared by the streaming guard, the whole-reply guard and the leak check; a parity test for every stream cut; golden transcripts in `apps/chatbot` |
| A host forgets admin auth and exposes transcripts or config | Every `/admin` handler takes `authorize` and refuses without it; a refusal test per handler |
| Client or employer IP leaks into a sellable repo | Domain-word lint on `src/`, synthetic fixtures only, an API review in K7 that reads every file once for APRIL data |
| Behaviour drifts while code moves out of `apps/chatbot` | Its suite unchanged, guard parity, golden transcripts byte for byte, the judge's labelled set at 120 of 120 |
| A consumer can't install the package (registry auth) | K0 publishes an empty `0.0.1` and installs it from the registry before code moves (G-1) |
| The kernel API fits only the quote pack | `examples/grounded-kb` is a second consumer in tests from the start |
| A consumer's tests or CI call a real model and cost money or flake | Dummy adapter in every test; real-model scripts refuse under `CI` or `VERCEL` |

## Three layers

1. **Kernel**: LLM port and streaming turn engine, number guard (whole-reply and streaming, one figure definition), grounding check (each value the model passes was said by the user), judge with pack-defined verdicts, canaries and leak scoring, eval runners. Domain-free.
2. **Intake policy**: `IntakePlan`, the ordered slots a conversation collects before a completion tool runs. Optional; a pack may have none (free Q&A).
3. **Domain packs**: tools, facts, persona, judge verdicts, renderers and strings. They live in consuming apps, never in this repo, except one synthetic example (`examples/grounded-kb`).

## Layout and boundaries

```
packages/grounded-chat/
  src/
    index.ts              turn engine, guard, grounding, intake, judge, types
    adapters/gemini/      the only code that does network I/O
    adapters/dummy/       scripted adapter for tests and examples
    http/                 rate limit, origin check, message cap, token budget, client IP
    client/               SSE reader, embed parameter parsing, contrast helper (no React)
    react/                useGroundedChat(), primitives, <ChatWidget>, <Playground>
    admin/                admin handlers behind authorize
    admin-react/          admin panels
    eval/                 judge-eval, latency and second-grader runners, small CLI
  package.json            "exports" map with one entry per folder above
examples/
  grounded-kb/            synthetic knowledge-base pack consuming the built package like an outside app
tooling/eslint-config/    purity and domain-word lint rules
docs/                     quickstart, API notes, consumer handover notes
```

- One subpath per folder, one tsup entry per subpath. A consumer importing the core never loads React or an adapter.
- Outside `src/adapters/` the code has no fetch, env or fs, so the core runs on server, edge or browser.
- Tools return `{ payload, authorizedFigures, snapshot? }`: the guard learns what it may show from tool results only.
- Storage is the `ChatStore` port (sessions, messages, snapshots, usage) with an in-memory adapter. The libsql repos stay in `apps/chatbot` and implement it.
- UI is styled only through CSS variables and `className` slots. React 19 and react-dom are optional peer dependencies.
- Auth is always the host's. The SDK takes an `authorize` callback and never owns accounts.

## Locked decisions

D-1 to D-9 in `decisions.md` were taken with Jan on 2026-10-10 and are not re-asked: own private repo, package name and registry, 0.x until back-bar ships, extraction now as K0 to K7, intake derived later from the pricing model, SDK ships chat UI and generic admin, CSS variables only, deny-by-default admin, Gemini as the first real adapter.

## Dev loop across two repos

Day to day, `apps/chatbot` points at the local checkout through an npm `overrides` entry that is never committed. Commits only carry a pinned registry version. A kernel fix lands as: SDK commit, changeset, publish, bump in the consumer, consumer gate.

## Risks

- **Registry auth blocks a deploy** (I think about **30%** on the first try). K0 proves it with an empty package. Fallback: a vendored `npm pack` tarball as a `file:` dependency, about 1 hour. Tracked as G-1.
- **Wrong abstraction from one consumer.** Every kernel API must serve both the quote pack and `examples/grounded-kb` in tests.
- **Behaviour drift during the move.** Golden transcripts, guard parity and the judge's 120 of 120 catch it. A golden mismatch stops the batch.
- **IP leakage into a sellable repo.** Domain-word lint, synthetic fixtures only, K7 API review.
- **Visual regression in the chatbot widget or admin** while moving off Tailwind classes (I think **40%** that K5 needs a second pass on at least one screen). Screenshot baseline from K0; a changed screenshot stops the batch until it matches or Jan accepts it.
- **Free-tier key** makes the K4 eval re-run slow (15 requests a minute). Costs time, not correctness.
