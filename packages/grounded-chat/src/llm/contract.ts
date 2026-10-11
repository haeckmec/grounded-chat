import { streamTurn, type ChatMessage, type LlmPort, type LlmStreamEvent, type ToolSchema } from './port.js';

/** The conversations a pack runs every adapter through. */
export interface LlmPortContractInput {
  /** The pack's tools, passed on every call. */
  tools: ToolSchema[];
  /** A first message that opens a conversation. */
  opening: ChatMessage[];
  /** A conversation complete enough that a model would call a tool. */
  readyForTool: ChatMessage[];
  /** A conversation whose last message is a tool result to narrate. */
  toolResult: ChatMessage[];
}

/** One check of the contract: a name and a function that throws when the adapter breaks it. */
export interface LlmPortContractCase {
  name: string;
  run(makeAdapter: () => LlmPort): Promise<void>;
}

function fail(message: string): never {
  throw new Error(`LlmPort contract: ${message}`);
}

async function collect(stream: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function checkToolCalls(calls: unknown, tools: ToolSchema[]): void {
  if (calls === undefined) return;
  if (!Array.isArray(calls)) fail('toolCalls is not an array');
  for (const call of calls as Array<{ id?: unknown; name?: unknown; arguments?: unknown }>) {
    if (typeof call.id !== 'string' || call.id.length === 0) fail('a tool call has an empty id');
    if (!tools.some((tool) => tool.name === call.name)) fail(`a tool call names an unknown tool "${String(call.name)}"`);
    if (typeof call.arguments !== 'object' || call.arguments === null) fail('a tool call has no arguments object');
  }
}

/**
 * The structural contract every `LlmPort` adapter meets, whatever a real model decides to say:
 * every turn is a reply, tool calls or both; every tool call is well formed; a streamed turn is text
 * deltas then one `done` whose reply the deltas join to. It checks shape, never wording.
 *
 * Framework-free: register each case with your test runner, for example
 * `for (const c of llmPortContractCases(input)) it(c.name, () => c.run(makeAdapter))`.
 */
export function llmPortContractCases(input: LlmPortContractInput): LlmPortContractCase[] {
  const { tools } = input;
  const streamCases = (
    [
      ['an opening question', input.opening],
      ['a conversation ready for a tool', input.readyForTool],
      ['a tool result to narrate', input.toolResult],
    ] as const
  ).map(
    ([label, messages]): LlmPortContractCase => ({
      name: `streams ${label} as text deltas, then one done event last, whose reply the deltas join to`,
      async run(makeAdapter) {
        const events = await collect(streamTurn(makeAdapter(), messages, tools));
        const done = events.filter((event) => event.type === 'done');
        if (done.length !== 1) fail(`expected one done event, got ${done.length}`);
        if (events.at(-1)?.type !== 'done') fail('the done event is not last');
        const first = done[0];
        const turn = first?.type === 'done' ? first.turn : {};
        const text = events.map((event) => (event.type === 'text' ? event.text : '')).join('');
        if (text !== (turn.reply ?? '')) fail('the deltas do not join to the reply');
        const hasToolCalls = Array.isArray(turn.toolCalls) && turn.toolCalls.length > 0;
        if (text.length === 0 && !hasToolCalls) fail('a streamed turn has neither text nor tool calls');
        checkToolCalls(turn.toolCalls, tools);
      },
    }),
  );

  return [
    {
      name: 'resolves a turn with a reply, tool calls, or both, never neither',
      async run(makeAdapter) {
        const turn = await makeAdapter().complete(input.opening, tools);
        const hasReply = typeof turn.reply === 'string' && turn.reply.length > 0;
        const hasToolCalls = Array.isArray(turn.toolCalls) && turn.toolCalls.length > 0;
        if (!hasReply && !hasToolCalls) fail('the turn has neither a reply nor tool calls');
      },
    },
    {
      name: 'every tool call has a non-empty id, a known tool name, and an arguments object',
      async run(makeAdapter) {
        const turn = await makeAdapter().complete(input.readyForTool, tools);
        checkToolCalls(turn.toolCalls, tools);
      },
    },
    {
      name: 'narrates a tool result without throwing',
      async run(makeAdapter) {
        const turn = await makeAdapter().complete(input.toolResult, tools);
        if (turn === undefined || turn === null) fail('narrating a tool result returned nothing');
      },
    },
    ...streamCases,
  ];
}
