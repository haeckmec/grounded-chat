/** One stored config row and its concurrency token. */
export interface ConfigRow {
  value: unknown;
  /**
   * An opaque token that changes on every write, echoed as an ETag and checked as If-Match. Empty
   * for a row that has never been written.
   */
  updatedAt: string;
}

/** Key/JSON config rows. The host implements it on its own storage; values arrive validated. */
export interface ConfigStore {
  getRow(key: string): Promise<ConfigRow | null>;
  /** Unconditional write; returns the new token. */
  set(key: string, value: unknown): Promise<string>;
  /**
   * Writes only while the row's token still equals `expectedUpdatedAt` (empty for a row never
   * written); returns the new token, or null when another writer got there first.
   */
  setIfUnchanged(key: string, value: unknown, expectedUpdatedAt: string): Promise<string | null>;
}

/** The reference `ConfigStore`, in memory. */
export class InMemoryConfigStore implements ConfigStore {
  private readonly rows = new Map<string, ConfigRow>();

  async getRow(key: string): Promise<ConfigRow | null> {
    const row = this.rows.get(key);
    return row ? { value: structuredClone(row.value), updatedAt: row.updatedAt } : null;
  }

  async set(key: string, value: unknown): Promise<string> {
    const updatedAt = globalThis.crypto.randomUUID();
    this.rows.set(key, { value: structuredClone(value), updatedAt });
    return updatedAt;
  }

  async setIfUnchanged(key: string, value: unknown, expectedUpdatedAt: string): Promise<string | null> {
    const current = this.rows.get(key)?.updatedAt ?? '';
    if (current !== expectedUpdatedAt) return null;
    return this.set(key, value);
  }
}

/** One check of the config store contract. */
export interface ConfigStoreContractCase {
  name: string;
  run(makeStore: () => ConfigStore | Promise<ConfigStore>): Promise<void>;
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ConfigStore contract: ${message}`);
}

/** What the config handlers rely on from any `ConfigStore`; register each case with your test runner. */
export function configStoreContractCases(): ConfigStoreContractCase[] {
  return [
    {
      name: 'a missing key is null; a written one comes back with a token',
      async run(makeStore) {
        const store = await makeStore();
        check((await store.getRow('model')) === null, 'a missing key is not null');
        const token = await store.set('model', { name: 'm' });
        const row = await store.getRow('model');
        check(JSON.stringify(row?.value) === '{"name":"m"}' && row?.updatedAt === token, 'the written row or its token did not come back');
      },
    },
    {
      name: 'every write makes a new token',
      async run(makeStore) {
        const store = await makeStore();
        const first = await store.set('k', 1);
        const second = await store.set('k', 1);
        check(first !== second, 'two writes returned the same token');
      },
    },
    {
      name: 'a conditional write lands with the current token and is refused with a stale one',
      async run(makeStore) {
        const store = await makeStore();
        const inserted = await store.setIfUnchanged('k', 'first', '');
        check(inserted !== null, 'a first write with an empty token was refused');
        check((await store.setIfUnchanged('k', 'stale', '')) === null, 'a write with an empty token overwrote a written row');
        const next = await store.setIfUnchanged('k', 'second', inserted!);
        check(next !== null, 'a write with the current token was refused');
        check((await store.setIfUnchanged('k', 'late', inserted!)) === null, 'a write with a stale token landed');
        check((await store.getRow('k'))?.value === 'second', 'the refused writes changed the row');
      },
    },
  ];
}
