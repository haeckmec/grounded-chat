/**
 * Dummy adapter: a scripted `LlmPort` for tests, CI and offline demos. It makes no network call; a
 * pack supplies the script that decides each turn from the conversation so far.
 */
import type { ChatMessage, LlmPort, LlmStreamEvent, LlmTurn, ModelOpts, ToolSchema } from '../../llm/port.js';

/** Decides one turn from the conversation, the way a real model would, but deterministically. */
export type DummyScript = (messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts) => LlmTurn | Promise<LlmTurn>;

export interface DummyLlmOptions {
  /** Characters per streamed delta; small enough by default that figures split across deltas. */
  chunkSize?: number;
  /** Whether to report an estimated token count; on by default so token budgets can be exercised. */
  estimateTokens?: boolean;
}

/**
 * A rough usage estimate, about 4 characters a token, for an adapter that makes no real call but
 * still has to drive a token budget.
 */
export function estimateTokens(messages: ChatMessage[], turn: LlmTurn): number {
  const contextChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  return Math.ceil((contextChars + (turn.reply?.length ?? 0)) / 4);
}

/**
 * Stateless per call, exactly like a real model API: every decision comes from the `messages`
 * passed in, nothing is kept on the instance.
 */
export class DummyLlmAdapter implements LlmPort {
  private readonly chunkSize: number;
  private readonly estimate: boolean;

  constructor(
    private readonly script: DummyScript,
    options: DummyLlmOptions = {},
  ) {
    this.chunkSize = options.chunkSize ?? 7;
    this.estimate = options.estimateTokens ?? true;
  }

  async complete(messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts): Promise<LlmTurn> {
    const turn = await this.script(messages, tools, opts);
    return this.estimate ? { ...turn, tokensUsed: estimateTokens(messages, turn) } : turn;
  }

  async *stream(messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts): AsyncGenerator<LlmStreamEvent> {
    const turn = await this.complete(messages, tools, opts);
    const reply = turn.reply ?? '';
    for (let at = 0; at < reply.length; at += this.chunkSize) {
      yield { type: 'text', text: reply.slice(at, at + this.chunkSize) };
    }
    yield { type: 'done', turn };
  }
}

/** A fresh tool call id, the shape a real provider returns. */
export function dummyCallId(): string {
  return globalThis.crypto.randomUUID();
}
