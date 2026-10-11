# grounded-kb example

A complete pack on a synthetic tea-blend knowledge base, consuming `@haeckmec/grounded-chat` like an outside app. Shaped like a question-answering chat rather than a form: it is the starting point for Jan's Back Bar's "Ask Jan".

| File | What it shows |
| --- | --- |
| `src/kb.ts` | The knowledge base: blends with measures, substitutes, one untested blend |
| `src/pack.ts` | The `TurnPack`: two tools, `measureFigures`, a one-slot `IntakePlan`, canaries, the "untested riff" rule, a `JudgeSpec` with its own verdict |
| `src/dummy.ts` | The scripted model the tests and the conversation run on |
| `src/server.ts` | The chat endpoint (SSE, a custom `recipe` event) and the admin handlers, as Web handlers |
| `src/ui.tsx` | The widget with a recipe card renderer, and the admin with three panels |
| `scripts/conversation.ts` | The scripted conversation; `npm run conversation` prints it and fails on any mismatch |

Every test runs on the dummy adapter: the conversation word for word, the LLM and store contracts, the chat endpoint, a refusal per admin endpoint, the UI against the in-memory server, and a labelled set for the pack's verdict through `/eval`.

`npm run check:packed` at the repository root runs all of it against the packed tarball, outside the workspace.
