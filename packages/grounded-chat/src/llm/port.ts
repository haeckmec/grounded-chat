/** Who wrote a message in a model conversation. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** One tool call a model asked for. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** One message of a model conversation. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on an assistant message that is calling tools instead of, or alongside, replying. */
  toolCalls?: ToolCall[] | undefined;
  /** Present on a `tool` message: which call this result answers. */
  toolCallId?: string | undefined;
  /** Present on a `tool` message: the tool's name. */
  name?: string | undefined;
  /**
   * Opaque, adapter-specific data from the turn that produced this message, carried through a tool
   * loop untouched so the same adapter can replay it on the next round. Never read outside the
   * adapter that set it.
   */
  providerState?: unknown;
}

/** A tool the model may call. */
export interface ToolSchema {
  name: string;
  description: string;
  /** JSON schema of the arguments. */
  parameters: Record<string, unknown>;
}

/** Per-call model options. Adapters ignore what they cannot apply. */
export interface ModelOpts {
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  /** For models that replaced temperature with a thinking budget. */
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | undefined;
  /** A JSON schema the reply must follow, for callers that read the reply as data. */
  responseSchema?: Record<string, unknown> | undefined;
}

/** What one model call returned. */
export interface LlmTurn {
  /** Absent when the turn only calls tools. */
  reply?: string | undefined;
  toolCalls?: ToolCall[] | undefined;
  /** Usage reported by the adapter, when known. */
  tokensUsed?: number | undefined;
  /** Opaque state to attach to the assistant message this turn produces (see `ChatMessage.providerState`). */
  providerState?: unknown;
}

/**
 * A streamed turn: any number of `text` deltas, then exactly one `done`, last, carrying the whole
 * turn. The deltas joined equal `done.turn.reply` (both empty when the turn only calls tools). Tool
 * calls arrive only in `done`, whole, never in pieces.
 */
export type LlmStreamEvent = { type: 'text'; text: string } | { type: 'done'; turn: LlmTurn };

/** The port every model adapter implements. Tests use the dummy adapter; CI never calls a real model. */
export interface LlmPort {
  complete(messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts): Promise<LlmTurn>;
  /** The same turn as `complete`, with its text as it is generated. Optional: callers go through `streamTurn`. */
  stream?(messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts): AsyncIterable<LlmStreamEvent>;
}

/** Streams a turn from any port, falling back to `complete` for an adapter that cannot stream. */
export async function* streamTurn(
  port: LlmPort,
  messages: ChatMessage[],
  tools: ToolSchema[],
  opts?: ModelOpts,
): AsyncGenerator<LlmStreamEvent> {
  if (port.stream) {
    yield* port.stream(messages, tools, opts);
    return;
  }
  const turn = await port.complete(messages, tools, opts);
  if (turn.reply) yield { type: 'text', text: turn.reply };
  yield { type: 'done', turn };
}

/**
 * A non-2xx answer from a real model provider. The status carries meaning a caller reacts to
 * differently from a bug: 429 means wait, 503 may be retried.
 */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
