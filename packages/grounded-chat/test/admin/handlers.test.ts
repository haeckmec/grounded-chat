import { describe, expect, it } from 'vitest';
import {
  coerceLocalizedList,
  coerceLocalizedText,
  configStoreContractCases,
  createConfigHandlers,
  createPruneHandler,
  createStatsHandler,
  createTranscriptHandler,
  findSecretShapedKeys,
  InMemoryConfigStore,
  type Authorize,
  type ConfigValidator,
} from '../../src/admin/index.js';
import { InMemoryChatStore } from '../../src/index.js';

const allow: Authorize = () => true;
const request = (init: RequestInit = {}) => new Request('https://host.example/api/admin', init);

// A hand-written validator in the safeParse shape: an object with a string `name`.
const named: ConfigValidator = {
  safeParse: (value) =>
    value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string'
      ? { success: true, data: { name: (value as { name: string }).name } }
      : { success: false, error: { issues: [{ message: 'name is required' }] } },
};

function handlers(authorize: Authorize) {
  return createConfigHandlers({ authorize, store: new InMemoryConfigStore(), validators: { model: named } });
}

describe('every handler refuses without authorize', () => {
  const store = new InMemoryChatStore();
  const cases: Array<[string, (authorize: Authorize) => Promise<Response>]> = [
    ['config GET', (authorize) => handlers(authorize).GET(request(), 'model')],
    ['config PUT', (authorize) => handlers(authorize).PUT(request({ method: 'PUT', body: '{"name":"x"}' }), 'model')],
    ['transcript GET', (authorize) => createTranscriptHandler({ authorize, store })(request(), 's')],
    ['prune POST', (authorize) => createPruneHandler({ authorize, store, retentionDays: () => 30 })(request({ method: 'POST' }))],
    ['stats GET', (authorize) => createStatsHandler({ authorize, stats: async () => ({ attempts: 1 }) })(request())],
  ];

  for (const [name, call] of cases) {
    it(`${name}: 401 when authorize says no, throws, or is missing`, async () => {
      for (const authorize of [() => false, async () => false, () => Promise.reject(new Error('down')), undefined as unknown as Authorize, (() => 'yes') as unknown as Authorize]) {
        const response = await call(authorize);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Not authorized.' });
      }
    });
  }
});

describe('config handlers', () => {
  it('reads a never-saved key as null with an empty ETag, and 404s an unknown key', async () => {
    const h = handlers(allow);
    const response = await h.GET(request(), 'model');
    expect(await response.json()).toEqual({ key: 'model', value: null });
    expect(response.headers.get('etag')).toBe('');
    expect((await h.GET(request(), 'nope')).status).toBe(404);
    expect((await h.PUT(request({ method: 'PUT', body: '{}' }), 'nope')).status).toBe(404);
  });

  it('validates a save and returns the issues', async () => {
    const response = await handlers(allow).PUT(request({ method: 'PUT', body: '{"other":1}' }), 'model');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid config.', issues: [{ message: 'name is required' }] });
  });

  it('saves with If-Match only while the row is unchanged, and unconditionally without it', async () => {
    const h = handlers(allow);
    const first = await h.PUT(request({ method: 'PUT', headers: { 'if-match': '' }, body: '{"name":"a"}' }), 'model');
    const etag = first.headers.get('etag')!;
    expect(first.status).toBe(200);
    const stale = await h.PUT(request({ method: 'PUT', headers: { 'if-match': '' }, body: '{"name":"b"}' }), 'model');
    expect(stale.status).toBe(409);
    const next = await h.PUT(request({ method: 'PUT', headers: { 'if-match': etag }, body: '{"name":"c"}' }), 'model');
    expect(next.status).toBe(200);
    const blind = await h.PUT(request({ method: 'PUT', body: '{"name":"d"}' }), 'model');
    expect(await blind.json()).toEqual({ key: 'model', value: { name: 'd' } });
    const read = await h.GET(request(), 'model');
    expect(read.headers.get('etag')).toBe(blind.headers.get('etag'));
  });
});

describe('transcript, prune and stats handlers', () => {
  it('lists a session transcript, empty for an unknown one', async () => {
    const store = new InMemoryChatStore();
    const { id } = await store.createSession(null);
    await store.appendMessage(id, 'user', 'hi');
    const get = createTranscriptHandler({ authorize: allow, store });
    expect((await (await get(request(), id)).json()).messages.map((m: { content: string }) => m.content)).toEqual(['hi']);
    expect(await (await get(request(), 'unknown')).json()).toEqual({ messages: [] });
  });

  it('prunes with the configured retention and says when none is set', async () => {
    const store = new InMemoryChatStore();
    expect(await (await createPruneHandler({ authorize: allow, store, retentionDays: async () => 30 })(request())).json()).toEqual({ deleted: 0 });
    const none = await createPruneHandler({ authorize: allow, store, retentionDays: () => undefined })(request());
    expect(none.status).toBe(400);
    expect(await none.json()).toEqual({ error: 'No retention period is configured.' });
  });

  it('serves the tally uncached', async () => {
    const response = await createStatsHandler({ authorize: allow, stats: async () => ({ attempts: 3 }) })(request());
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ attempts: 3 });
  });
});

describe('ConfigStore contract: InMemoryConfigStore', () => {
  for (const contractCase of configStoreContractCases()) it(contractCase.name, () => contractCase.run(() => new InMemoryConfigStore()));
});

describe('findSecretShapedKeys', () => {
  it('finds credential-shaped keys at any depth, and lets usage settings through', () => {
    const issues = findSecretShapedKeys({ apiKey: 'x', nested: { clientSecret: 'y', list: [{ password: 'z' }] }, tokenBudgetPerSession: 5, authToken: 't' });
    expect(issues.map((issue) => issue.path.join('.'))).toEqual(['apiKey', 'nested.clientSecret', 'nested.list.0.password', 'authToken']);
    expect(issues[0]!.message).toBe('Config key "apiKey" looks like a secret and must live in an env var instead, never in config.');
    expect(findSecretShapedKeys({ tokenCount: 1, tokenUsed: 2, tokenLimit: 3, name: 'n' })).toEqual([]);
    expect(findSecretShapedKeys('apiKey')).toEqual([]);
  });
});

describe('localized text', () => {
  const fallback = { en: 'Hello', fr: 'Bonjour' };
  it('keeps a legacy plain string as the first language', () => {
    expect(coerceLocalizedText('Hi', fallback)).toEqual({ en: 'Hi', fr: 'Bonjour' });
    expect(coerceLocalizedText({ fr: 'Salut' }, fallback)).toEqual({ en: 'Hello', fr: 'Salut' });
    expect(coerceLocalizedText(42, fallback)).toEqual(fallback);
  });
  it('does the same for lists', () => {
    const lists = { en: ['a'], fr: ['b'] };
    expect(coerceLocalizedList(['x'], lists)).toEqual({ en: ['x'], fr: ['b'] });
    expect(coerceLocalizedList({ en: ['y'] }, lists)).toEqual({ en: ['y'], fr: ['b'] });
    expect(coerceLocalizedList('nope', lists)).toEqual(lists);
  });
});
