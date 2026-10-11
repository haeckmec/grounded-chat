# Quickstart

Grounded chat in four steps: a pack, a store, a turn endpoint, a widget. Everything here runs on the dummy adapter; swap in Gemini at the end. `examples/grounded-kb` is the same thing, complete and tested.

## 1. Install

See the repository README for the `.npmrc`. Then `npm install --save-exact @haeckmec/grounded-chat` (and `react react-dom` for the UI).

## 2. Write the pack

A pack is everything domain-specific: tools, the system prompt, which figures the guard checks, and what a reply may state.

```ts
import { measureFigures, type TurnPack } from '@haeckmec/grounded-chat';

export const pack: TurnPack<{ name: string }> = {
  tools: [{ name: 'lookup', description: 'Look up a record by name.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } }],
  systemPrompt: () => 'Answer from the lookup tool only. State a measure only as the tool returned it.',
  figureClass: measureFigures, // or leave it out: money is the default
  replacement: "a measure I can't confirm",
  executeTool: async (call) => {
    const record = await findRecord(String(call.arguments.name)); // your data
    if (!record) return { payload: { reason: 'Not found.' } };
    return { payload: record, authorizedFigures: record.figures, snapshot: { value: { name: record.name }, key: record.name } };
  },
};
```

The rule that makes it grounded: a figure reaches the user only if a tool returned it, through `authorizedFigures`. Anything else is replaced, while streaming, with the pack's `replacement`.

## 3. Serve a turn

```ts
import { InMemoryChatStore, runTurn } from '@haeckmec/grounded-chat';
import { DummyLlmAdapter } from '@haeckmec/grounded-chat/adapters/dummy';

const store = new InMemoryChatStore(); // implement ChatStore on your own storage for production
const llm = new DummyLlmAdapter((messages) => ({ reply: 'Which record?' })); // your scripted model for tests

export async function POST(request: Request) {
  const { sessionId: given, message } = await request.json();
  const sessionId = given ?? (await store.createSession(request.headers.get('origin'))).id;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const result = await runTurn({ llm, store, pack, sessionId, userMessage: message, onDelta: (text) => send('delta', { text }) });
        send('done', { sessionId, reply: result.reply });
      } catch (error) {
        send('error', { status: (error as { status?: number }).status ?? 500 });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}
```

Put `guardPublicRequest` from `/http` in front of it before anything public.

## 4. Show it

```tsx
import { ChatWidget, GroundedChatStyles } from '@haeckmec/grounded-chat/react';

export function Chat() {
  return (
    <>
      <GroundedChatStyles />
      <ChatWidget languages={['en']} strings={{ en: { title: 'Ask me' } }} fetch={fetch} />
    </>
  );
}
```

Or build your own UI on `useGroundedChat()`.

## Going live

- `new GeminiLlmAdapter({ apiKey: process.env.GEMINI_API_KEY! })` from `/adapters/gemini`. The key comes from env, never config.
- Run the LLM contract on any adapter you write: `llmPortContractCases(...)`. Run the store contract on your store: `chatStoreContractCases()`.
- Grade replies: a `JudgeSpec` with `defaultVerdicts(scope)` plus your own, `runJudge`, and `/eval`'s `gradeEvalSet` and `agreement` on a labelled set.
- Admin: mount `/admin` handlers behind your own login (`authorize`), and the `/admin-react` panels in your admin.
