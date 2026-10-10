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

ESM only, Node 20+. React 19 is an optional peer dependency, needed only for `/react` and `/admin-react`.

## Subpaths

| Import | What it holds |
| --- | --- |
| `@haeckmec/grounded-chat` | Turn engine, figure guard, grounding check, intake plan, judge, types. No fetch, env or fs |
| `@haeckmec/grounded-chat/adapters/gemini` | Gemini LLM adapter |
| `@haeckmec/grounded-chat/adapters/dummy` | Scripted adapter for tests and examples |
| `@haeckmec/grounded-chat/http` | Rate limit, origin check, message cap, token budget, client IP |
| `@haeckmec/grounded-chat/client` | SSE reader, embed parameter parsing, contrast helper. No React |
| `@haeckmec/grounded-chat/react` | `useGroundedChat()`, chat primitives, `<ChatWidget>`, `<Playground>` |
| `@haeckmec/grounded-chat/admin` | Admin handlers, each behind the host's `authorize` callback |
| `@haeckmec/grounded-chat/admin-react` | Admin panels |
| `@haeckmec/grounded-chat/eval` | Judge eval, latency and second-grader runners, small CLI |

In 0.0.x every subpath resolves and exports nothing yet.

## Develop

```
npm install
npx turbo run typecheck lint build test
```

`CLAUDE.md` holds the repo rules; `_reference/` holds the plan, architecture and decisions.

## License

UNLICENSED. All rights reserved.
