import { describe, expect, it, vi } from 'vitest';
import {
  createSweepThrottle,
  DEFAULT_REPLACEMENTS,
  DEFAULT_TURN_STRINGS,
  InMemoryChatStore,
  LlmProviderError,
  runTurn,
  type LlmPort,
  type LlmStreamEvent,
  type LlmTurn,
  type RunTurnOptions,
  type TurnPack,
} from '../../src/index.js';
import { LOOKUP_TOOL } from '../helpers/contract.js';

interface Record_ {
  city: string;
  total: number;
}

type Round = { texts: string[]; turn: LlmTurn; failAfter?: number } | LlmProviderError;

/** A port that streams scripted rounds in order; a round may fail after some of its deltas. */
function scripted(rounds: Round[]): LlmPort & { requests: unknown[][] } {
  let index = 0;
  const port = {
    requests: [] as unknown[][],
    complete: async (): Promise<LlmTurn> => {
      throw new Error('runTurn streams');
    },
    async *stream(messages: unknown[]): AsyncGenerator<LlmStreamEvent> {
      port.requests.push(JSON.parse(JSON.stringify(messages)));
      const round = rounds[index++];
      if (!round) throw new Error('no scripted round left');
      if (round instanceof LlmProviderError) throw round;
      for (const [at, text] of round.texts.entries()) {
        if (round.failAfter === at) throw new LlmProviderError('high demand', 503);
        yield { type: 'text', text };
      }
      yield { type: 'done', turn: round.turn };
    },
  };
  return port;
}

const call = (id: string, city: string, age = 22) => ({ id, name: 'lookup_record', arguments: { city, age } });
const say = (text: string): Round => ({ texts: [text], turn: { reply: text } });
const tools = (...calls: ReturnType<typeof call>[]): Round => ({ texts: [], turn: { toolCalls: calls } });

const TOTALS: Record<string, number> = { Lisbon: 1480, Porto: 900 };

function pack(overrides: Partial<TurnPack<Record_>> = {}): TurnPack<Record_> {
  return {
    tools: [LOOKUP_TOOL],
    systemPrompt: () => 'You look up records.',
    executeTool: async (toolCall) => {
      const city = String(toolCall.arguments.city);
      const total = TOTALS[city];
      if (total === undefined) return { payload: { reason: 'No record.' } };
      const value = { city, total };
      return { payload: value, snapshot: { value, key: city }, authorizedFigures: [total] };
    },
    ...overrides,
  };
}

async function turn(options: Partial<RunTurnOptions<Record_>> & { llm: LlmPort; store?: InMemoryChatStore<Record_> }, message = 'Lisbon please') {
  const store = options.store ?? new InMemoryChatStore<Record_>();
  const sessionId = options.sessionId ?? (await store.createSession(null)).id;
  const deltas: string[] = [];
  const result = await runTurn({
    pack: pack(),
    sessionId,
    userMessage: message,
    onDelta: (text) => deltas.push(text),
    retryDelayMs: 0,
    now: () => 0,
    ...options,
    store,
  });
  return { result, deltas, store, sessionId };
}

describe('runTurn', () => {
  it('runs the tool loop: the result goes back to the model, which then answers with the returned figure', async () => {
    const llm = scripted([tools(call('c1', 'Lisbon')), say('The record says 1480.00 EUR.')]);
    const { result, deltas, store, sessionId } = await turn({ llm });
    expect(result.reply).toBe('The record says 1480.00 EUR.');
    expect(deltas.join('')).toBe(result.reply);
    expect(llm.requests[1]).toContainEqual({ role: 'tool', toolCallId: 'c1', name: 'lookup_record', content: '{"city":"Lisbon","total":1480}' });
    expect(result.snapshotsThisTurn).toEqual([{ key: 'Lisbon', value: { city: 'Lisbon', total: 1480 } }]);
    expect(await store.listSnapshots(sessionId)).toEqual([{ city: 'Lisbon', total: 1480 }]);
    expect(result.metrics).toMatchObject({ llmRoundTrips: 2, toolCalls: 1, narratedLocally: false, providerRetries: 0 });
  });

  it('replaces any figure no tool returned, streamed across chunks, with the pack replacement', async () => {
    const llm = scripted([{ texts: ['It is about 1 2', '50,50 EUR.'], turn: { reply: 'It is about 1 250,50 EUR.' } }]);
    const { result } = await turn({ llm, pack: pack({ replacement: DEFAULT_REPLACEMENTS.fr }) });
    expect(result.reply).toBe(`It is about ${DEFAULT_REPLACEMENTS.fr}.`);
    expect(result.guard).toEqual({ redactedAmounts: [1250.5], redactedWords: [], authorizedAmounts: [] });
  });

  it('keeps figures a tool returned authorized on later turns of the session', async () => {
    const store = new InMemoryChatStore<Record_>();
    const { sessionId } = await turn({ llm: scripted([tools(call('c1', 'Lisbon')), say('Done.')]), store });
    const { result } = await turn({ llm: scripted([say('As I said, 1480.00 EUR.')]), store, sessionId }, 'remind me');
    expect(result.reply).toBe('As I said, 1480.00 EUR.');
    expect(await store.listAuthorizedFigures(sessionId)).toEqual([1480]);
  });

  it('lets the pack compute the authorized figures from the snapshots', async () => {
    const llm = scripted([tools(call('c1', 'Lisbon'), call('c2', 'Porto')), say('Together 2380.00 EUR.')]);
    const authorizedFigures = vi.fn(({ snapshots }: { snapshots: Record_[] }) => [snapshots.reduce((sum, s) => sum + s.total, 0)]);
    const { result } = await turn({ llm, pack: pack({ authorizedFigures }) });
    expect(result.reply).toBe('Together 2380.00 EUR.');
    expect(result.guard?.authorizedAmounts).toEqual([2380]);
  });

  it('replaces a keyed snapshot within the turn and does not save a reused one twice', async () => {
    const store = new InMemoryChatStore<Record_>();
    const save = vi.spyOn(store, 'saveSnapshot');
    const llm = scripted([tools(call('c1', 'Lisbon'), call('c2', 'Lisbon')), say('Done.')]);
    const reusing = pack({
      executeTool: async (toolCall, context) => {
        const earlier = context.snapshotsThisTurn.find((s) => s.key === 'Lisbon');
        if (earlier) return { payload: earlier.value, snapshot: { value: earlier.value, key: 'Lisbon', reused: true } };
        const value = { city: String(toolCall.arguments.city), total: 1480 };
        return { payload: value, snapshot: { value, key: 'Lisbon' } };
      },
    });
    const { result } = await turn({ llm, store, pack: reusing });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.snapshotsThisTurn).toHaveLength(1);
  });

  it('calls afterToolRound with the snapshots of each round that produced some', async () => {
    const afterToolRound = vi.fn();
    const llm = scripted([tools(call('c1', 'Nowhere')), tools(call('c2', 'Porto')), say('Done.')]);
    await turn({ llm, pack: pack({ afterToolRound }) });
    expect(afterToolRound.mock.calls).toEqual([[[{ city: 'Porto', total: 900 }]]]);
  });

  it('separates text from a later round with a space and keeps text written before a tool call', async () => {
    const llm = scripted([{ texts: ['Let me check.'], turn: { reply: 'Let me check.', toolCalls: [call('c1', 'Lisbon')] } }, say('It is 1480.00 EUR.')]);
    const { result } = await turn({ llm });
    expect(result.reply).toBe('Let me check. It is 1480.00 EUR.');
  });

  it('answers with the pack text when the model ends without an answer, marked as narrated locally', async () => {
    const llm = scripted([tools(call('c1', 'Lisbon'))]);
    const { result } = await turn({
      llm,
      limits: { maxToolRounds: 1 },
      pack: pack({ noAnswerReply: (snapshots) => ({ text: `Record: ${snapshots[0]!.value.total}.00 EUR.`, fromToolResults: true }) }),
    });
    expect(result.reply).toBe('Record: 1480.00 EUR.');
    expect(result.metrics?.narratedLocally).toBe(true);
  });

  it('falls back to the generic text when the last round says nothing and the pack has no answer', async () => {
    const { result } = await turn({ llm: scripted([{ texts: [], turn: {} }]) });
    expect(result.reply).toBe(DEFAULT_TURN_STRINGS.fallback);
    expect(result.metrics?.narratedLocally).toBe(false);
  });

  it('retries a provider 503 once before any text was sent', async () => {
    const llm = scripted([new LlmProviderError('busy', 503), say('Hello.')]);
    const { result } = await turn({ llm });
    expect(result.reply).toBe('Hello.');
    expect(result.metrics?.providerRetries).toBe(1);
  });

  it('does not retry once text was sent, and persists nothing for the failed turn', async () => {
    const llm = scripted([{ texts: ['Hello there, ', 'more'], turn: { reply: '' }, failAfter: 1 }, say('never')]);
    const store = new InMemoryChatStore<Record_>();
    const { id } = await store.createSession(null);
    await expect(turn({ llm, store, sessionId: id })).rejects.toThrow(LlmProviderError);
    expect(await store.listMessages(id)).toEqual([]);
  });

  it('does not retry a 429', async () => {
    await expect(turn({ llm: scripted([new LlmProviderError('quota', 429), say('x')]) })).rejects.toMatchObject({ status: 429 });
  });

  it('persists the user message and the reply together, and counts the tokens used', async () => {
    const llm = scripted([{ texts: ['Hi.'], turn: { reply: 'Hi.', tokensUsed: 12 } }]);
    const { store, sessionId } = await turn({ llm }, 'hello');
    expect((await store.listMessages(sessionId)).map((m) => [m.role, m.content])).toEqual([
      ['user', 'hello'],
      ['assistant', 'Hi.'],
    ]);
    expect((await store.getSession(sessionId))?.tokenCount).toBe(12);
  });

  it('sends the system prompt, the history and the new message to the model', async () => {
    const store = new InMemoryChatStore<Record_>();
    const { sessionId } = await turn({ llm: scripted([say('First.')]), store }, 'one');
    const llm = scripted([say('Second.')]);
    await turn({ llm, store, sessionId }, 'two');
    expect(llm.requests[0]).toEqual([
      { role: 'system', content: 'You look up records.' },
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'First.' },
      { role: 'user', content: 'two' },
    ]);
  });

  it('stops at the message cap and the token budget without calling the model', async () => {
    const store = new InMemoryChatStore<Record_>();
    const { id } = await store.createSession(null);
    await store.appendMessage(id, 'user', 'a');
    const llm = scripted([]);
    const capped = await turn({ llm, store, sessionId: id, limits: { maxMessagesPerSession: 1 } });
    expect(capped.result).toEqual({ reply: DEFAULT_TURN_STRINGS.messageCap, capped: true });
    expect(capped.deltas).toEqual([DEFAULT_TURN_STRINGS.messageCap]);
    await store.incrementTokenCount(id, 100);
    const budget = await turn({ llm, store, sessionId: id, limits: { tokenBudgetPerSession: 100 }, pack: pack({ strings: { tokenBudget: 'Budget spent.' } }) });
    expect(budget.result).toEqual({ reply: 'Budget spent.', capped: true });
    expect(llm.requests).toHaveLength(0);
  });

  it('prunes expired messages through the throttle when retention is set', async () => {
    const store = new InMemoryChatStore<Record_>();
    const prune = vi.spyOn(store, 'pruneExpiredMessages');
    const throttle = createSweepThrottle({ now: () => 0 });
    await turn({ llm: scripted([say('a')]), store, retention: { days: 30, throttle } });
    await turn({ llm: scripted([say('b')]), store, retention: { days: 30, throttle } });
    expect(prune).toHaveBeenCalledTimes(1);
    expect(prune).toHaveBeenCalledWith(30);
  });

  it('throws for an unknown session', async () => {
    await expect(turn({ llm: scripted([]), sessionId: 'nope' })).rejects.toThrow(/Unknown chat session/);
  });

  it('reports the thinking level and the time to the first delta', async () => {
    let t = 0;
    const llm = scripted([say('Hi.')]);
    const { result } = await turn({ llm, now: () => (t += 5), modelOpts: { thinkingLevel: 'low' } });
    expect(result.metrics?.thinkingLevel).toBe('low');
    expect(result.metrics?.timeToFirstDeltaMs).toBeGreaterThan(0);
  });
});
