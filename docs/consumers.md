# Consumer notes

## Quoteproof (`apps/chatbot` in northstar-react)

The quote pack. It runs every layer: `runTurn` with its `get_quote`/`list_benefits` executors and household figure rule, `QUOTE_INTAKE_PLAN`, its own `JudgeSpec` wording, the widget with its Tailwind classes in the slots and the quote card as a renderer, the admin handlers behind its basic-auth check, and three of the admin panels. Data source and Leads stay in the pack.

- Install: a vendored tarball in `apps/chatbot/vendor` until a session with a `read:packages` token switches it to the exact registry pin (gap G-1).
- Proof it did not move: golden transcripts (every request, delta and result of eight conversations) and a golden of the judge's requests, both byte for byte; 11 screens byte-identical to the baseline taken before any code moved; its Playwright suite.

## Jan's Back Bar ("Ask Jan", M3)

Start from `examples/grounded-kb`: it is shaped like Ask Jan.

1. Add the package at an exact version and the `.npmrc` from the README; `NODE_AUTH_TOKEN` in env, never committed.
2. Pack: tools that call `packages/bar-core` and `packages/kb` (shelf, makeable, substitution, twist lookups). Return each result's specs as `authorizedFigures`, and set `figureClass: measureFigures` so ml, cl, oz, dashes, parts and % ABV are guarded. Replacement text in Jan's voice.
3. Persona from `docs/ask-jan-voice.md` in `systemPrompt`; plant `createCanaries` codes in the prompt, rules and tools.
4. Judge: `defaultVerdicts('your bar and what you can make with it')` plus the must-nevers as your own `VerdictDefinition`s (a drink suggested without naming what is missing, disputed history stated as fact, an unverified KB item stated as fact; see `unverifiedAsFact` in the example).
5. The "untested riff" label is a pack rule: the tool result carries the label, the prompt requires it, the judge checks it.
6. No intake plan, or a one-slot plan ("what is on your shelf?") like the example's.
7. Server: `runTurn` with `GeminiLlmAdapter` and a `ChatStore` on back-bar's storage (run `chatStoreContractCases` against it); `guardPublicRequest`, message cap and token budget.
8. UI: `useGroundedChat()` under the phone-first UI; `ChatWidget` is optional.
9. Admin, if wanted: `/admin` handlers and `/admin-react` panels behind back-bar's own auth via `authorize`.
10. Tests on `DummyLlmAdapter` with a script; a labelled set for the verdicts through `/eval`.
