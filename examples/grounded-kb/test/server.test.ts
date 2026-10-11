import { InMemoryChatStore, readServerSentEventsFromText } from './helpers.js';
import { InMemoryConfigStore } from '@haeckmec/grounded-chat/admin';
import { describe, expect, it } from 'vitest';
import { createKbDummy, createKbServer, kbRouter, type RecipeSnapshot } from '../src/index.js';

function server(authorize = (request: Request) => request.headers.get('authorization') === 'Bearer admin') {
  const store = new InMemoryChatStore<RecipeSnapshot>();
  const instance = createKbServer({ llm: createKbDummy(), store, configStore: new InMemoryConfigStore(), authorize });
  return { route: kbRouter(instance), store };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://kb.test/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('the chat endpoint', () => {
  it('streams guarded deltas, a recipe card event and done, and keeps the session', async () => {
    const { route, store } = server();
    const first = await readServerSentEventsFromText(await (await route(post({ message: 'hello' }))).text());
    const done = first.find((e) => e.event === 'done')!.data as { sessionId: string; suggestedReplies: Array<{ label: string }> };
    expect(done.suggestedReplies.map((r) => r.label)).toEqual(['Harbour Mist', 'Ember Chai', 'Lantern Riff']);

    const second = await readServerSentEventsFromText(await (await route(post({ sessionId: done.sessionId, message: 'Ember Chai' }))).text());
    expect(second.map((e) => e.event)).toContain('recipe');
    const text = second.filter((e) => e.event === 'delta').map((e) => (e.data as { text: string }).text).join('');
    expect(text).toBe('Ember Chai: 2 tsp black tea, 1 tsp ginger, 60 ml oat milk, 190 ml water; steep 5 minutes.');
    expect((await store.listMessages(done.sessionId)).length).toBe(4);
  });

  it('refuses an empty message and an unknown session', async () => {
    const { route } = server();
    expect((await route(post({}))).status).toBe(400);
    expect((await route(post({ sessionId: 'nope', message: 'hi' }))).status).toBe(404);
  });

  it('counts held figures in the public tally', async () => {
    const { route } = server();
    await (await route(post({ message: 'how much roughly?' }))).text();
    const stats = await (await route(new Request('http://kb.test/api/playground/stats'))).json();
    expect(stats).toMatchObject({ attempts: 1, held: 1, leaked: 0 });
  });
});

describe('the admin endpoints', () => {
  it('refuse without the admin and answer the admin', async () => {
    const { route } = server();
    for (const [method, path] of [
      ['GET', '/api/admin/config/model'],
      ['PUT', '/api/admin/config/model'],
      ['POST', '/api/admin/prune'],
      ['GET', '/api/admin/sessions/s/messages'],
    ] as const) {
      const init = { method, ...(method === 'PUT' ? { body: '{"provider":"dummy"}' } : {}) };
      expect((await route(new Request(`http://kb.test${path}`, init))).status).toBe(401);
      expect((await route(new Request(`http://kb.test${path}`, { ...init, headers: { authorization: 'Bearer admin' } }))).status).not.toBe(401);
    }
  });

  it('refuses a secret-shaped config key', async () => {
    const { route } = server();
    const response = await route(new Request('http://kb.test/api/admin/config/model', { method: 'PUT', headers: { authorization: 'Bearer admin' }, body: '{"apiKey":"x"}' }));
    expect(response.status).toBe(400);
  });
});
