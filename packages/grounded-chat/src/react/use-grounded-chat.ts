import { useCallback, useRef, useState } from 'react';
import { readServerSentEvents } from '../client/sse.js';
import type { QuickReply } from '../intake/plan.js';

/** A text message on screen. `streamId` marks what one streamed turn added. */
export interface TextMessageView {
  type: 'text';
  role: 'user' | 'assistant';
  content: string;
  streamId?: number | undefined;
}

/** A message a pack renders itself, such as a result card, named after the stream event that carried it. */
export interface CustomMessageView<D = unknown> {
  type: 'custom';
  name: string;
  data: D;
  streamId?: number | undefined;
}

/** Any message on screen: text, or a custom message a pack renders. */
export type ChatMessageView = TextMessageView | CustomMessageView;

/** The `done` event's payload. */
export interface ChatDoneEvent {
  sessionId: string;
  reply: string;
  suggestedReplies?: QuickReply[] | undefined;
}

/** Options for `useGroundedChat`. */
export interface UseGroundedChatOptions {
  /** The host's streaming chat endpoint; `/api/chat` when absent. */
  endpoint?: string;
  /**
   * Extra fields sent with every turn, such as the language or a page context. Read when a message
   * is sent, so it may change between turns.
   */
  body?: () => Record<string, unknown>;
  /**
   * Stream events besides `delta`, `done` and `error`, mapped to the data of a custom message. The
   * message sits after this turn's text; a second event of the same name in the turn replaces it.
   * Returning undefined ignores the event.
   */
  customEvents?: Record<string, (data: unknown) => unknown>;
  /** The error text to show for a failed turn; `status` is the HTTP or provider status when known. */
  errorText: (status: number | undefined) => string;
  /** Messages a new or reset conversation starts with, such as a welcome. */
  initialMessages?: () => ChatMessageView[];
  /**
   * The host's fetch, usually the global one. Passed in so the package itself makes no network
   * call, and so tests can stub the endpoint.
   */
  fetch: typeof fetch;
}

/** The chat state and actions `useGroundedChat` returns. */
export interface GroundedChat {
  messages: ChatMessageView[];
  sessionId: string | undefined;
  suggestedReplies: QuickReply[] | undefined;
  /** True from sending until the turn ends. */
  loading: boolean;
  /** True once the current turn's first text has arrived. */
  streaming: boolean;
  error: string | undefined;
  sendMessage(text: string): Promise<void>;
  /** Starts over: aborts a turn in flight, forgets the session, and shows the given or initial messages. */
  reset(messages?: ChatMessageView[]): void;
  /** Replaces the transcript only while it is empty, such as a welcome that loaded after mount. */
  seedIfEmpty(messages: ChatMessageView[]): void;
}

/**
 * Chat state and streaming for any UI: sends a turn to the host's endpoint as a stream request, fills
 * the assistant's reply in as guarded deltas arrive, shows custom messages from named events, and
 * removes a failed turn's partial reply, since the server persisted nothing for it. A reset while a
 * turn is in flight aborts it, and a late response for a superseded conversation is dropped.
 */
export function useGroundedChat(options: UseGroundedChatOptions): GroundedChat {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageView[]>(() => options.initialMessages?.() ?? []);
  const [suggestedReplies, setSuggestedReplies] = useState<QuickReply[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // A reset bumps the generation and aborts the request in flight; a response for an older
  // generation is ignored, so it can neither append to nor re-attach the session of a conversation
  // the user already left.
  const generationRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);
  const streamCounterRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reset = useCallback((next?: ChatMessageView[]) => {
    generationRef.current += 1;
    inFlightRef.current?.abort();
    inFlightRef.current = null;
    setSessionId(undefined);
    setMessages(next ?? optionsRef.current.initialMessages?.() ?? []);
    setSuggestedReplies(undefined);
    setError(undefined);
    setLoading(false);
    setStreaming(false);
  }, []);

  const seedIfEmpty = useCallback((next: ChatMessageView[]) => {
    setMessages((prev) => (prev.length === 0 ? next : prev));
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const current = optionsRef.current;

    const generation = generationRef.current;
    const controller = new AbortController();
    inFlightRef.current = controller;

    setMessages((prev) => [...prev, { type: 'text', role: 'user', content: trimmed }]);
    setSuggestedReplies(undefined);
    setLoading(true);
    setError(undefined);

    const streamId = ++streamCounterRef.current;
    let streamedText = '';
    // Every update rebuilds from `streamedText` rather than appending to state, so a state updater
    // that React runs twice still produces the same transcript.
    const showText = (content: string) =>
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.type === 'text' && m.streamId === streamId);
        if (index === -1) return [...prev, { type: 'text', role: 'assistant', content, streamId }];
        const next = [...prev];
        next[index] = { type: 'text', role: 'assistant', content, streamId };
        return next;
      });
    const dropTurn = () => setMessages((prev) => prev.filter((m) => m.streamId !== streamId));

    try {
      // Called unbound: a browser's fetch refuses to run with another object as `this`.
      const doFetch = current.fetch;
      const response = await doFetch(current.endpoint ?? '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, message: trimmed, ...current.body?.(), stream: true }),
        signal: controller.signal,
      });
      if (generationRef.current !== generation) return;
      if (!response.ok || !response.body) {
        setError(current.errorText(response.status));
        return;
      }

      let finished = false;
      for await (const { event, data } of readServerSentEvents(response.body)) {
        if (generationRef.current !== generation) return;
        if (event === 'delta') {
          streamedText += (data as { text: string }).text;
          setStreaming(true);
          showText(streamedText);
        } else if (event === 'done') {
          const done = data as ChatDoneEvent;
          finished = true;
          setSessionId(done.sessionId);
          showText(done.reply);
          setSuggestedReplies(done.suggestedReplies);
        } else if (event === 'error') {
          finished = true;
          dropTurn();
          setError(current.errorText((data as { status?: number }).status));
        } else {
          const map = current.customEvents?.[event];
          const custom = map?.(data);
          if (custom === undefined) continue;
          // The custom message sits right after this turn's reply, which fills in above it.
          setMessages((prev) => {
            const without = prev.filter((m) => !(m.type === 'custom' && m.name === event && m.streamId === streamId));
            const hasText = without.some((m) => m.type === 'text' && m.streamId === streamId);
            const textEntry: ChatMessageView[] = hasText ? [] : [{ type: 'text', role: 'assistant', content: streamedText, streamId }];
            return [...without, ...textEntry, { type: 'custom', name: event, data: custom, streamId }];
          });
        }
      }
      if (!finished && generationRef.current === generation) {
        dropTurn();
        setError(current.errorText(undefined));
      }
    } catch {
      // An abort from a reset is not an error, nor is a response for a superseded conversation.
      if (controller.signal.aborted || generationRef.current !== generation) return;
      dropTurn();
      setError(current.errorText(undefined));
    } finally {
      if (generationRef.current === generation) {
        setLoading(false);
        setStreaming(false);
      }
    }
  };

  return { messages, sessionId, suggestedReplies, loading, streaming, error, sendMessage, reset, seedIfEmpty };
}
