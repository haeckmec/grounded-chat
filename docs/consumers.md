# Consumer notes

## Example: a quote assistant

A quote assistant pack that runs every layer: `runTurn` with its own tool executors and a money figure rule, an intake plan, its own `JudgeSpec` wording, the widget with its own classes in the slots and the quote card as a renderer, the admin handlers behind a basic-auth check, and some of the admin panels. The data source stays in the pack.

- Install: the exact registry pin, or a packed tarball until a token with `read:packages` is available.
- Proof it did not change: golden transcripts (every request, delta and result of a set of conversations) and a golden of the judge's requests, both byte for byte; screens byte-identical to a baseline taken before any code moved; the app's own end-to-end suite.

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
