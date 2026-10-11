import type { ChatStore } from './port.js';

/** One check of the store contract: a name and a function that throws when the adapter breaks it. */
export interface ChatStoreContractCase {
  name: string;
  run(makeStore: () => ChatStore | Promise<ChatStore>): Promise<void>;
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ChatStore contract: ${message}`);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The behaviour the turn engine relies on from any `ChatStore`. Framework-free: register each case
 * with your test runner, for example `for (const c of chatStoreContractCases()) it(c.name, () => c.run(makeStore))`.
 * Snapshots are plain JSON objects in these cases, so a store that serializes them passes too.
 */
export function chatStoreContractCases(): ChatStoreContractCase[] {
  return [
    {
      name: 'creates a session with zero counts and finds it again; an unknown id is null',
      async run(makeStore) {
        const store = await makeStore();
        const session = await store.createSession('https://example.test');
        check(session.id.length > 0, 'a session id is empty');
        check(session.messageCount === 0 && session.tokenCount === 0, 'a new session has non-zero counts');
        const found = await store.getSession(session.id);
        check(found?.origin === 'https://example.test', 'the session was not found with its origin');
        check((await store.getSession('no-such-session')) === null, 'an unknown session id is not null');
      },
    },
    {
      name: 'appends messages in order and counts each one on the session',
      async run(makeStore) {
        const store = await makeStore();
        const { id } = await store.createSession(null);
        await store.appendMessage(id, 'user', 'first');
        await store.appendMessage(id, 'assistant', 'second');
        await store.appendMessage(id, 'user', 'third');
        const messages = await store.listMessages(id);
        check(same(messages.map((m) => [m.role, m.content]), [['user', 'first'], ['assistant', 'second'], ['user', 'third']]), 'messages are not listed in order');
        check((await store.getSession(id))?.messageCount === 3, 'the message count is not 3');
      },
    },
    {
      name: 'adds to the token count and ignores a non-positive increment',
      async run(makeStore) {
        const store = await makeStore();
        const { id } = await store.createSession(null);
        await store.incrementTokenCount(id, 40);
        await store.incrementTokenCount(id, 2);
        await store.incrementTokenCount(id, 0);
        check((await store.getSession(id))?.tokenCount === 42, 'the token count is not 42');
      },
    },
    {
      name: 'a keyed snapshot replaces the earlier one under the same key; unkeyed ones accumulate',
      async run(makeStore) {
        const store = await makeStore();
        const { id } = await store.createSession(null);
        await store.saveSnapshot(id, { subject: 'a', total: 1 }, 'a');
        await store.saveSnapshot(id, { subject: 'b', total: 2 }, 'b');
        await store.saveSnapshot(id, { subject: 'a', total: 3 }, 'a');
        await store.saveSnapshot(id, { subject: 'free', total: 4 });
        await store.saveSnapshot(id, { subject: 'free', total: 5 });
        const snapshots = await store.listSnapshots(id);
        check(
          same(snapshots, [{ subject: 'b', total: 2 }, { subject: 'a', total: 3 }, { subject: 'free', total: 4 }, { subject: 'free', total: 5 }]),
          `snapshots are ${JSON.stringify(snapshots)}`,
        );
      },
    },
    {
      name: 'keeps authorized figures per session',
      async run(makeStore) {
        const store = await makeStore();
        const one = await store.createSession(null);
        const two = await store.createSession(null);
        await store.saveAuthorizedFigures(one.id, [500, 80]);
        await store.saveAuthorizedFigures(one.id, []);
        const figures = await store.listAuthorizedFigures(one.id);
        check(same([...figures].sort((a, b) => a - b), [80, 500]), 'the figures were not kept');
        check((await store.listAuthorizedFigures(two.id)).length === 0, 'figures leaked into another session');
      },
    },
    {
      name: 'prunes messages older than the retention window and keeps newer ones',
      async run(makeStore) {
        const store = await makeStore();
        const { id } = await store.createSession(null);
        await store.appendMessage(id, 'user', 'kept');
        const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        check((await store.pruneExpiredMessages(30, future)) === 0, 'a message inside the window was pruned');
        check((await store.pruneExpiredMessages(5, future)) === 1, 'an expired message was not pruned');
        check((await store.listMessages(id)).length === 0, 'the expired message is still listed');
      },
    },
  ];
}
