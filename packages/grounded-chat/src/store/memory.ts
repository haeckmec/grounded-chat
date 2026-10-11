import type { ChatSession, ChatStore, StoredMessage, StoredMessageRole } from './port.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The reference `ChatStore`: everything in memory, per instance. For tests, examples and a single
 * process; a deployment implements the port on durable storage.
 */
export class InMemoryChatStore<S = unknown> implements ChatStore<S> {
  private readonly sessions = new Map<string, ChatSession>();
  private readonly messages = new Map<string, StoredMessage[]>();
  private readonly snapshots = new Map<string, Array<{ key: string | undefined; snapshot: S }>>();
  private readonly figures = new Map<string, number[]>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async createSession(origin: string | null): Promise<ChatSession> {
    const session: ChatSession = {
      id: globalThis.crypto.randomUUID(),
      createdAt: this.clock().toISOString(),
      origin,
      messageCount: 0,
      tokenCount: 0,
    };
    this.sessions.set(session.id, session);
    return { ...session };
  }

  async getSession(id: string): Promise<ChatSession | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async appendMessage(sessionId: string, role: StoredMessageRole, content: string): Promise<void> {
    const list = this.messages.get(sessionId) ?? [];
    list.push({ role, content, createdAt: this.clock().toISOString() });
    this.messages.set(sessionId, list);
    const session = this.sessions.get(sessionId);
    if (session) session.messageCount += 1;
  }

  async listMessages(sessionId: string): Promise<StoredMessage[]> {
    return (this.messages.get(sessionId) ?? []).map((message) => ({ ...message }));
  }

  async incrementTokenCount(sessionId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    const session = this.sessions.get(sessionId);
    if (session) session.tokenCount += tokens;
  }

  async saveSnapshot(sessionId: string, snapshot: S, key?: string): Promise<void> {
    const list = (this.snapshots.get(sessionId) ?? []).filter((entry) => key === undefined || entry.key !== key);
    list.push({ key, snapshot });
    this.snapshots.set(sessionId, list);
  }

  async listSnapshots(sessionId: string): Promise<S[]> {
    return (this.snapshots.get(sessionId) ?? []).map((entry) => entry.snapshot);
  }

  async saveAuthorizedFigures(sessionId: string, figures: number[]): Promise<void> {
    if (figures.length === 0) return;
    this.figures.set(sessionId, [...(this.figures.get(sessionId) ?? []), ...figures]);
  }

  async listAuthorizedFigures(sessionId: string): Promise<number[]> {
    return [...(this.figures.get(sessionId) ?? [])];
  }

  async pruneExpiredMessages(retentionDays: number, now: Date = this.clock()): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString();
    let pruned = 0;
    for (const [sessionId, list] of this.messages) {
      const kept = list.filter((message) => message.createdAt >= cutoff);
      pruned += list.length - kept.length;
      this.messages.set(sessionId, kept);
    }
    return pruned;
  }
}
