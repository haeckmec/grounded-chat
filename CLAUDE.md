Mode: full. Switch with `/altitude light` only if every full trigger in `_reference/methodology.md` has gone away.

# grounded-chat

`@haeckmec/grounded-chat`: a private TypeScript SDK for grounded chat. An LLM chat that only states figures and facts the host app's own tools returned, refuses guesses, and proves it with a judge and evals. Consumers: Quoteproof (northstar-react) and Jan's Back Bar.

## Read before working
- `_reference/execution-prompt.md`: current batch and gate, resume block.
- `_reference/methodology.md`: how this repo is built, gated and verified.
- `_reference/architecture.md`: layers, failure modes, boundaries, locked decisions.
- `_reference/plan.md`: the spec. Batches K0 to K7, where each part lives, dev loop, risks, what is not built.
- `_reference/gaps.md`: what's open. Search it before calling a bug new.
- `_reference/decisions.md`: calls already made. Don't re-ask them.

**Precedence when documents disagree:** the current plan in `_reference/` > this file > the architecture doc. If none covers it, stop and ask.

Global rules (voice, code comments, about Jan) apply from `~/.claude`; they are not repeated here.

## Layout
```
packages/grounded-chat/   the SDK; one folder under src/ per subpath export
  subpaths.ts             the subpath list; build entries come from it, a test checks it against "exports"
examples/grounded-kb/     synthetic pack consuming the built package like an outside app
tooling/eslint-config/    shared lint config: purity and domain-word rules, with their tests
docs/                     quickstart, API notes, consumer handover notes
_reference/               execution prompt, methodology, architecture, plan, decisions, gaps, retro
.changeset/               pending changesets; they write CHANGELOG.md
.github/workflows/        ci.yml (gate on push and PR), release.yml (publish on a v* tag)
```

## Repo rules
1. **Core is pure.** Everything outside `src/adapters/` has no fetch, env or fs. Lint-enforced (`no-restricted-globals`, `no-restricted-imports`, `no-restricted-syntax`).
2. **No domain words in `packages/grounded-chat/src/`.** Lint list: insurance, premium, quote, rate table, cocktail, bar, drink, plus plurals. Packs bring their own words. ("policy" is allowed, D-11.)
3. **Synthetic fixtures only.** No APRIL product data, rate tables, benefit copy or real `.product` content ever enters this repo, tests included.
4. **Tests and CI never call a real endpoint.** Real-model scripts refuse to run when `CI` or `VERCEL` is set, and need a key from env.
5. **Credentials are env vars, never config or the repo.** `GEMINI_API_KEY` for adapters; the registry token is `NODE_AUTH_TOKEN`.
6. **Every public export is documented and tested.** A new export without a doc comment and a test fails review.
7. **The figure guard is one definition.** The streaming guard, the whole-reply guard and the leak check share it, and a parity test proves streaming equals whole-reply for every cut.
8. **Admin handlers are deny by default.** Each has a test that it refuses without `authorize`.
9. **A breaking change needs a changeset that says so.** Consumers pin exact versions.
10. **Code comments** follow Jan's comment standard: they explain why, never name a batch, phase, plan, date, person, ticket or doc path.
11. **Instrumentation writes to files, never `console.*`** in library code. Lint-enforced (`no-console` in `src/`).
12. **A new subpath** goes into `subpaths.ts`, the `exports` map and `examples/grounded-kb/test/subpaths.test.ts` in the same commit.

## Gate
- Iterating: `npx turbo run typecheck lint` plus the unit tests touched.
- Before every commit: `npx turbo run typecheck lint build test`. Red means stop.
- Before a publish: the above, plus `examples/grounded-kb` builds and runs its scripted conversation on the dummy adapter against the packed tarball (`npm pack`), as an outside consumer would.

## Release
`npx changeset` with each change. To publish: `npx changeset version`, commit, tag `v<version>` on that commit, push the tag. `release.yml` checks the tag against the package version, runs the gate and publishes to GitHub Packages with `GITHUB_TOKEN`. Publishing is outward: ask Jan before pushing a tag.

## Non-negotiables
1. `--affected` runs are for iterating; they never authorise a commit.
2. Commit with `git commit --only <paths>`.
3. Restate goal and files before a batch's gate, wait for confirmation; inside a confirmed gate, continue batch to batch.
4. A config field or export is added and deprecated, never renamed.
5. Fix one instance of a bug pattern, audit the same pattern in the same commit.

## Playbooks
- `C:\DATEN\Vibecoding\Claude\Cowork\jan-context\playbooks\ports-and-mocks.md` (candidate, not written yet; see `merlyon-funnel/apps/api/src/ports/` and `quote-chatbot-standalone/src/server/ports/`): `LlmPort`, adapters and `ChatStore`.
- `C:\DATEN\Vibecoding\Claude\Cowork\jan-context\playbooks\grounded-chat.md` (candidate, not written yet; see `quote-chatbot-standalone/src/server/guards/`): this repo is likely its future example.
