# @haeckmec/grounded-chat

A TypeScript SDK for grounded chat: an LLM chat that only states figures and facts the host app's own tools returned, refuses guesses, and proves it with a judge and evals.

**The API is not stable until 1.0.** Pin an exact version. Every release lists its changes in [CHANGELOG.md](packages/grounded-chat/CHANGELOG.md), and breaking changes say so.

## Install

The package is private, on GitHub Packages. Add an `.npmrc` next to your `package.json`:

```
@haeckmec:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Set `NODE_AUTH_TOKEN` in your environment (and in CI and your host) to a GitHub token with `read:packages`. Never write the token into the file.

```
npm install --save-exact @haeckmec/grounded-chat
```

ESM, with a `default` export condition so CommonJS callers can `require` it on Node 20.19+. React 19 is an optional peer dependency, needed only for `/react` and `/admin-react`.

## Subpaths

| Import | What it holds |
| --- | --- |
| `@haeckmec/grounded-chat` | `runTurn` and `TurnPack`, the figure guard (`moneyFigures`, `measureFigures`), `ChatStore`, `IntakePlan`, the judge and `scoreReply`, canaries, `LlmPort` and its contract. No fetch, env or fs |
| `@haeckmec/grounded-chat/adapters/gemini` | `GeminiLlmAdapter` |
| `@haeckmec/grounded-chat/adapters/dummy` | `DummyLlmAdapter`, a scripted adapter a pack drives with its own script |
| `@haeckmec/grounded-chat/http` | Rate limit, origin check, client key, `guardPublicRequest`, message cap, token budget |
| `@haeckmec/grounded-chat/client` | SSE reader, embed parameter parsing, contrast helper, web font list. No React |
| `@haeckmec/grounded-chat/react` | `useGroundedChat()`, `<ChatWidget>`, `<Playground>`, the default stylesheet |
| `@haeckmec/grounded-chat/admin` | Config, transcript, prune and stats handlers, each behind the host's `authorize`; `ConfigStore` |
| `@haeckmec/grounded-chat/admin-react` | Admin shell and panels: Conversation, Model, compliance and theme, transcripts |
| `@haeckmec/grounded-chat/eval` | Labelled-set grading, agreement, latency summaries, a timed port |

Start with [docs/quickstart.md](docs/quickstart.md). [docs/api.md](docs/api.md) walks through every subpath, [docs/ui-css-variables.md](docs/ui-css-variables.md) covers styling, [docs/consumers.md](docs/consumers.md) says how Quoteproof and Jan's Back Bar use it, and [examples/grounded-kb](examples/grounded-kb) is a complete pack to copy.

## Develop

```
npm install
npx turbo run typecheck lint build test
npm run check:packed   # the example on the packed tarball, as an outside app installs it
```

`CLAUDE.md` holds the repo rules.

## License

UNLICENSED. All rights reserved. See [LICENSE](LICENSE).
