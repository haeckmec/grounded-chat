// @vitest-environment jsdom
import { InMemoryChatStore } from '@haeckmec/grounded-chat';
import { InMemoryConfigStore } from '@haeckmec/grounded-chat/admin';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createKbDummy, createKbServer, kbRouter, type RecipeSnapshot } from '../src/index.js';
import { KbAdmin, KbChat } from '../src/ui.js';

afterEach(cleanup);

// The browser's fetch, served by the example's own handlers in memory.
function inMemoryFetch(authorization?: string): typeof globalThis.fetch {
  const route = kbRouter(
    createKbServer({ llm: createKbDummy(), store: new InMemoryChatStore<RecipeSnapshot>(), configStore: new InMemoryConfigStore(), authorize: () => true }),
  );
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    route(new Request(new URL(String(input), 'http://kb.test'), { ...init, headers: { ...(init?.headers as Record<string, string>), ...(authorization ? { authorization } : {}) } }))) as typeof globalThis.fetch;
}

describe('the example UI', () => {
  it('chats to a recipe card', async () => {
    render(<KbChat fetch={inMemoryFetch()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Harbour Mist' }));
    await waitFor(() => expect(screen.getByTestId('recipe-card').textContent).toContain('250 ml water'));
    expect(screen.getByText('Harbour Mist: 2 tsp green tea, 1 tsp mint, 250 ml water; steep 3 minutes.')).toBeTruthy();
  });

  it('shows the admin panels and saves one', async () => {
    render(<KbAdmin fetch={inMemoryFetch('Bearer admin')} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    expect(await screen.findByLabelText('Primary colour')).toBeTruthy();
  });
});
