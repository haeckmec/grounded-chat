import { DEFAULT_REPLACEMENTS, type FigureClass } from '../figures/figure-class.js';
import { StreamingNumberGuard } from '../figures/guard.js';
import { isMessageCapExceeded, isTokenBudgetExceeded, type SweepThrottle } from '../limits.js';
import { LlmProviderError, streamTurn, type ChatMessage, type LlmPort, type LlmTurn, type ModelOpts, type ToolCall, type ToolSchema } from '../llm/port.js';
import type { ChatStore } from '../store/port.js';

/** What a tool returns to the engine. */
export interface ToolOutcome<S = unknown> {
  /** Sent back to the model as the tool's result, JSON-encoded. */
  payload: unknown;
  /** Figures this result lets replies state, for the rest of the session. */
  authorizedFigures?: number[] | undefined;
  /**
   * A record to keep, saved through the store. With a key it replaces the session's earlier
   * snapshot under that key, and the turn's own list the same way. `reused` marks a snapshot this
   * turn already produced and the tool returned again: it is not saved a second time.
   */
  snapshot?: { value: S; key?: string | undefined; reused?: boolean | undefined } | undefined;
}

/** A snapshot this turn produced, with its key when it has one. */
export interface TurnSnapshot<S = unknown> {
  key: string | undefined;
  value: S;
}

/** What a tool sees of the turn it runs in. */
export interface ToolContext<S = unknown> {
  sessionId: string;
  /** Everything the user wrote in this session, this turn's message last. */
  userMessages: string[];
  /** Snapshots produced earlier in this turn, a keyed one replacing its earlier self. */
  snapshotsThisTurn: ReadonlyArray<TurnSnapshot<S>>;
}

/** The inputs a pack computes the figures a reply may state from. */
export interface FigureContext<S = unknown> {
  sessionId: string;
  /** Every snapshot saved in the session, this turn's included. */
  snapshots: S[];
  /** Figures earlier turns' tool results authorized, from the store. */
  sessionFigures: number[];
  /** Figures this turn's tool results authorized so far. */
  turnFigures: number[];
}

/** The text a turn sends when the model gave no answer of its own. */
export interface NoAnswerReply {
  text: string;
  /** True when the pack wrote it from tool results, false for a generic fallback. */
  fromToolResults: boolean;
}

/** User-facing texts the engine itself writes. English defaults; a pack passes its own. */
export interface TurnStrings {
  messageCap: string;
  tokenBudget: string;
  fallback: string;
}

/** The English texts `runTurn` writes itself; a pack overrides any of them with `strings`. */
export const DEFAULT_TURN_STRINGS: TurnStrings = {
  messageCap: 'This conversation has reached its message limit. Please start a new one.',
  tokenBudget: 'This conversation has reached its token budget. Please start a new one.',
  fallback: "I'm having trouble completing that — could you try rephrasing?",
};

/** Everything domain-specific about a turn. The engine is the same for every pack. */
export interface TurnPack<S = unknown> {
  tools: ToolSchema[];
  /** The system prompt for this turn. */
  systemPrompt(): string;
  executeTool(call: ToolCall, context: ToolContext<S>): Promise<ToolOutcome<S>>;
  /**
   * Every figure a reply may state right now, read at the start of each model round. Defaults to
   * the session's stored figures followed by this turn's.
   */
  authorizedFigures?(context: FigureContext<S>): number[];
  /** Called after a tool round that produced at least one snapshot, before the next round. */
  afterToolRound?(snapshotsThisRound: S[]): Promise<void> | void;
  /**
   * The answer when the model ended without one (the rounds ran out, or its last round said
   * nothing). Undefined falls back to `strings.fallback`.
   */
  noAnswerReply?(snapshotsThisTurn: ReadonlyArray<TurnSnapshot<S>>): NoAnswerReply | undefined;
  /** Which figures to guard; money when absent. */
  figureClass?: FigureClass;
  /** What replaces a figure no tool returned. */
  replacement?: string;
  strings?: Partial<TurnStrings>;
}

/** Per-session and per-turn limits. */
export interface TurnLimits {
  /** Messages a session may hold; 40 when absent. */
  maxMessagesPerSession?: number | undefined;
  /** Model rounds per turn; 6 when absent. */
  maxToolRounds?: number | undefined;
  /** Tokens a session may spend; no budget when absent. */
  tokenBudgetPerSession?: number | undefined;
}

/** Everything one call to `runTurn` needs. */
export interface RunTurnOptions<S = unknown> {
  llm: LlmPort;
  store: ChatStore<S>;
  pack: TurnPack<S>;
  sessionId: string;
  userMessage: string;
  /** Called with each piece of text as it is sent; every piece has already passed the guard. */
  onDelta?: ((text: string) => void) | undefined;
  limits?: TurnLimits | undefined;
  modelOpts?: ModelOpts | undefined;
  /** Prunes old messages at most once per throttle interval. */
  retention?: { days: number; throttle: SweepThrottle } | undefined;
  /** Clock for the turn's wall time; injectable so tests read exact figures. */
  now?: (() => number) | undefined;
  /** Wait before the one retry after a provider 503; injectable so tests do not wait. */
  retryDelayMs?: number | undefined;
}

/** What one turn cost. */
export interface TurnMetrics {
  wallMs: number;
  /** From the start of the turn to the first guarded text sent; null when the turn sent none. */
  timeToFirstDeltaMs: number | null;
  /** Provider 503s retried before any text was sent: zero or one. */
  providerRetries: number;
  llmRoundTrips: number;
  toolCalls: number;
  /** True when the pack answered from tool results because the model did not. */
  narratedLocally: boolean;
  thinkingLevel: ModelOpts['thinkingLevel'] | null;
}

/** What the guard did to a turn's reply, and the figures it allowed. */
export interface TurnGuardReport {
  redactedAmounts: number[];
  redactedWords: string[];
  authorizedAmounts: number[];
}

/** What one turn produced: the reply as shown and persisted, the snapshots, the guard report and the metrics. */
export interface RunTurnResult<S = unknown> {
  /** Everything the user was shown this turn, already guarded; what was persisted. */
  reply: string;
  /** True when a message cap or token budget ended the turn before any model call. */
  capped?: true;
  snapshotsThisTurn?: Array<TurnSnapshot<S>>;
  guard?: TurnGuardReport;
  metrics?: TurnMetrics;
}

const DEFAULT_MAX_MESSAGES = 40;
// Enough for a household of four handled one subject per round, plus the reply.
const DEFAULT_MAX_TOOL_ROUNDS = 6;
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * One chat turn: from a session and a user message to a guarded, persisted reply. The tool loop runs
 * until the model answers without calling a tool or the rounds run out; every tool result goes back
 * to the model. Every piece of text passes the figure guard with the figures the tools have returned
 * so far. A provider 503 is retried once, and only before any text was sent. The user's message and
 * the reply are persisted together, only once the turn succeeded.
 */
export async function runTurn<S>(options: RunTurnOptions<S>): Promise<RunTurnResult<S>> {
  const { llm, store, pack, sessionId, userMessage, limits = {} } = options;
  const strings = { ...DEFAULT_TURN_STRINGS, ...pack.strings };
  const guardOptions = {
    ...(pack.figureClass ? { figureClass: pack.figureClass } : {}),
    replacement: pack.replacement ?? DEFAULT_REPLACEMENTS.en,
  };
  const now = options.now ?? Date.now;
  const startedAt = now();
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new Error(`Unknown chat session "${sessionId}".`);
  }

  if (isMessageCapExceeded(session.messageCount, limits.maxMessagesPerSession ?? DEFAULT_MAX_MESSAGES)) {
    options.onDelta?.(strings.messageCap);
    return { reply: strings.messageCap, capped: true };
  }
  if (isTokenBudgetExceeded(session.tokenCount, limits.tokenBudgetPerSession)) {
    options.onDelta?.(strings.tokenBudget);
    return { reply: strings.tokenBudget, capped: true };
  }

  if (options.retention) {
    const { days, throttle } = options.retention;
    await throttle.maybeRun(() => store.pruneExpiredMessages(days));
  }

  const history = await store.listMessages(sessionId);
  const messages: ChatMessage[] = [
    { role: 'system', content: pack.systemPrompt() },
    ...history.map((m): ChatMessage => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
  const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content);

  const snapshotsThisTurn: Array<TurnSnapshot<S>> = [];
  const turnFigures: number[] = [];
  const maxRounds = limits.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  let totalTokensUsed = 0;
  let llmRoundTrips = 0;
  let toolCallCount = 0;
  let narratedLocally = false;
  let providerRetries = 0;
  let firstDeltaAt: number | undefined;
  let finished = false;

  // What the user has been shown this turn, across rounds, already guarded. It is what gets
  // persisted and scored, so the transcript always matches the screen.
  let shown = '';
  let roundHasText = false;
  const redactedAmounts: number[] = [];
  const redactedWords: string[] = [];

  function send(text: string) {
    if (!text) return;
    // Text from a later round (after a tool call) reads as a new sentence, not glued to the last word.
    const separator = !roundHasText && shown && !/\s$/u.test(shown) && !/^\s/u.test(text) ? ' ' : '';
    roundHasText = true;
    firstDeltaAt ??= now();
    shown += separator + text;
    options.onDelta?.(separator + text);
  }

  // Read at the start of each round, so a figure a tool has just returned is allowed in the text
  // that follows it.
  async function authorizedFiguresNow(): Promise<number[]> {
    const snapshots = await store.listSnapshots(sessionId);
    const sessionFigures = await store.listAuthorizedFigures(sessionId);
    const context = { sessionId, snapshots, sessionFigures, turnFigures: [...turnFigures] };
    return pack.authorizedFigures ? pack.authorizedFigures(context) : [...sessionFigures, ...turnFigures];
  }

  async function sendGuarded(text: string) {
    const guard = new StreamingNumberGuard(await authorizedFiguresNow(), guardOptions);
    send(guard.push(text) + guard.end());
    redactedAmounts.push(...guard.redactedAmounts);
    redactedWords.push(...guard.redactedWords);
  }

  // One model round, streamed through the guard. A provider 503 is retried once, and only while
  // nothing has been sent: after the first delta a retry would repeat text the user saw.
  async function runRound(): Promise<LlmTurn> {
    const authorized = await authorizedFiguresNow();
    for (;;) {
      const guard = new StreamingNumberGuard(authorized, guardOptions);
      let turn: LlmTurn | undefined;
      try {
        for await (const event of streamTurn(llm, messages, pack.tools, options.modelOpts)) {
          if (event.type === 'text') send(guard.push(event.text));
          else turn = event.turn;
        }
        send(guard.end());
      } catch (error) {
        if (error instanceof LlmProviderError && error.status === 503 && providerRetries === 0 && firstDeltaAt === undefined) {
          providerRetries++;
          await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
          continue;
        }
        throw error;
      }
      redactedAmounts.push(...guard.redactedAmounts);
      redactedWords.push(...guard.redactedWords);
      return turn ?? {};
    }
  }

  for (let round = 0; round < maxRounds; round++) {
    roundHasText = false;
    const turn = await runRound();
    llmRoundTrips++;
    if (turn.tokensUsed) totalTokensUsed += turn.tokensUsed;

    if (turn.toolCalls && turn.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: turn.reply ?? '',
        toolCalls: turn.toolCalls,
        providerState: turn.providerState,
      });

      const snapshotsThisRound: Array<TurnSnapshot<S>> = [];
      for (const call of turn.toolCalls) {
        toolCallCount++;
        const outcome = await pack.executeTool(call, { sessionId, userMessages, snapshotsThisTurn });
        if (outcome.snapshot && !outcome.snapshot.reused) {
          const { value, key } = outcome.snapshot;
          await store.saveSnapshot(sessionId, value, key);
        }
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify(outcome.payload),
        });
        if (outcome.snapshot) {
          const { value, key } = outcome.snapshot;
          // A correction in the same turn replaces that subject's earlier snapshot here too.
          replaceKeyed(snapshotsThisTurn, { key, value });
          replaceKeyed(snapshotsThisRound, { key, value });
        }
        if (outcome.authorizedFigures) turnFigures.push(...outcome.authorizedFigures);
      }
      if (snapshotsThisRound.length > 0) await pack.afterToolRound?.(snapshotsThisRound.map((s) => s.value));
      // Results always go back to the model: a model that handles one subject per round needs the
      // next round for the rest, and ending the turn here would show a partial answer as the whole.
      continue;
    }

    finished = true;
    break;
  }

  // A turn that produced no text of its own (the rounds ran out, or the model's last round said
  // nothing) must not let a preamble ("Let me check that") stand as the whole answer.
  const answeredInText = finished && roundHasText;
  if (!answeredInText) {
    roundHasText = false;
    const fromPack = pack.noAnswerReply?.(snapshotsThisTurn);
    await sendGuarded(fromPack?.text ?? strings.fallback);
    narratedLocally = fromPack?.fromToolResults ?? false;
  }

  // A figure fetched this turn stays authorized on later turns, so restating it is not stripped.
  if (turnFigures.length > 0) {
    await store.saveAuthorizedFigures(sessionId, turnFigures);
  }
  const authorizedAmounts = await authorizedFiguresNow();

  if (totalTokensUsed > 0) {
    await store.incrementTokenCount(sessionId, totalTokensUsed);
  }
  // The user's message and its reply are persisted together, now that the model call succeeded:
  // a failed turn leaves no dangling message counting against the cap.
  await store.appendMessage(sessionId, 'user', userMessage);
  await store.appendMessage(sessionId, 'assistant', shown);

  return {
    reply: shown,
    snapshotsThisTurn,
    guard: { redactedAmounts, redactedWords, authorizedAmounts },
    metrics: {
      wallMs: now() - startedAt,
      timeToFirstDeltaMs: firstDeltaAt === undefined ? null : firstDeltaAt - startedAt,
      providerRetries,
      llmRoundTrips,
      toolCalls: toolCallCount,
      narratedLocally,
      thinkingLevel: options.modelOpts?.thinkingLevel ?? null,
    },
  };
}

function replaceKeyed<S>(list: Array<TurnSnapshot<S>>, entry: TurnSnapshot<S>): void {
  if (entry.key !== undefined) {
    const earlier = list.findIndex((existing) => existing.key === entry.key);
    if (earlier >= 0) list.splice(earlier, 1);
  }
  list.push(entry);
}
