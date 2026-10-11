import { describe, expect, it } from 'vitest';
import { DummyLlmAdapter, dummyCallId, estimateTokens } from '../../src/adapters/dummy/index.js';
import type { ChatMessage, LlmStreamEvent } from '../../src/index.js';
import { runLlmPortContractTests } from '../helpers/contract.js';

// A tiny script in the shape a pack writes: ask, call the tool once the user gave a city, narrate.
const script = (messages: ChatMessage[]) => {
  const last = messages.at(-1);
  if (last?.role === 'tool') return { reply: `The record says ${JSON.parse(last.content).total}.` };
  if (messages.some((m) => m.role === 'user' && /lisbon/i.test(m.content))) {
    return { toolCalls: [{ id: dummyCallId(), name: 'lookup_record', arguments: { city: 'Lisbon', age: 22 } }] };
  }
  return { reply: 'Which city?' };
};

runLlmPortContractTests('DummyLlmAdapter', () => new DummyLlmAdapter(script));

async function collect(stream: AsyncIterable<LlmStreamEvent>) {
  const events: LlmStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('DummyLlmAdapter', () => {
  it('reports a token estimate of about four characters a token', async () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'x'.repeat(40) }];
    const turn = await new DummyLlmAdapter(script).complete(messages, []);
    expect(turn.tokensUsed).toBe(estimateTokens(messages, turn));
    expect(turn.tokensUsed).toBe(Math.ceil((40 + 'Which city?'.length) / 4));
  });

  it('reports no usage when the estimate is switched off', async () => {
    const turn = await new DummyLlmAdapter(script, { estimateTokens: false }).complete([{ role: 'user', content: 'hi' }], []);
    expect(turn.tokensUsed).toBeUndefined();
  });

  it('streams the reply in chunks of the configured size, then the turn', async () => {
    const events = await collect(new DummyLlmAdapter(script, { chunkSize: 4 }).stream([{ role: 'user', content: 'hi' }], []));
    expect(events.slice(0, -1)).toEqual([
      { type: 'text', text: 'Whic' },
      { type: 'text', text: 'h ci' },
      { type: 'text', text: 'ty?' },
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'done', turn: { reply: 'Which city?' } });
  });

  it('gives each tool call a fresh id', () => {
    expect(dummyCallId()).not.toBe(dummyCallId());
  });
});
