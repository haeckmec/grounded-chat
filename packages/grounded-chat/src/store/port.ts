/** One conversation's bookkeeping. Counts are durable, so a cap holds across serverless cold starts. */
export interface ChatSession {
  id: string;
  createdAt: string;
  origin: string | null;
  messageCount: number;
  tokenCount: number;
}

/** Who wrote a persisted message. Tool rounds are never persisted, only what the user saw. */
export type StoredMessageRole = 'user' | 'assistant';

export interface StoredMessage {
  role: StoredMessageRole;
  content: string;
  createdAt: string;
}

/**
 * Storage for the turn engine: sessions, messages, tool snapshots and the figures a session may
 * state. The host implements it on its own storage; `InMemoryChatStore` is the reference adapter
 * and `chatStoreContractCases` the contract every adapter passes.
 */
export interface ChatStore<S = unknown> {
  createSession(origin: string | null): Promise<ChatSession>;
  getSession(id: string): Promise<ChatSession | null>;
  /** Appends a message and counts it on the session. */
  appendMessage(sessionId: string, role: StoredMessageRole, content: string): Promise<void>;
  /** The session's messages, oldest first. */
  listMessages(sessionId: string): Promise<StoredMessage[]>;
  incrementTokenCount(sessionId: string, tokens: number): Promise<void>;
  /**
   * Saves a tool snapshot. With a key, it replaces the session's earlier snapshot under the same key
   * in the same write, so one subject is never counted twice.
   */
  saveSnapshot(sessionId: string, snapshot: S, key?: string): Promise<void>;
  /** The session's snapshots in the order they were saved. */
  listSnapshots(sessionId: string): Promise<S[]>;
  /** Figures a tool returned, kept so later turns may restate them. */
  saveAuthorizedFigures(sessionId: string, figures: number[]): Promise<void>;
  listAuthorizedFigures(sessionId: string): Promise<number[]>;
  /** Deletes messages older than the retention window; returns how many went. */
  pruneExpiredMessages(retentionDays: number, now?: Date): Promise<number>;
}
