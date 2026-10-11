import { describe, expect, it } from 'vitest';
import { chatStoreContractCases, InMemoryChatStore } from '../src/index.js';

describe('ChatStore contract: InMemoryChatStore', () => {
  for (const contractCase of chatStoreContractCases()) {
    it(contractCase.name, () => contractCase.run(() => new InMemoryChatStore()));
  }
});

describe('chatStoreContractCases', () => {
  it('fails a store that forgets to count messages', async () => {
    class Forgetful extends InMemoryChatStore {
      override async getSession(id: string) {
        const session = await super.getSession(id);
        return session ? { ...session, messageCount: 0 } : null;
      }
    }
    const appends = chatStoreContractCases().find((c) => c.name.startsWith('appends messages'))!;
    await expect(appends.run(() => new Forgetful())).rejects.toThrow(/message count is not 3/);
  });
});
