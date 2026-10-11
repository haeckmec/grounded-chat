// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatWidget, GROUNDED_CHAT_CSS, GroundedChatStyles, Playground, PlaygroundStats, useGroundedChat } from '../../src/react/index.js';

afterEach(cleanup);

function sse(events: Array<[string, unknown]>): Response {
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  const bytes = new TextEncoder().encode(body);
  // Split mid-event so the reader has to hold a block across chunks.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 11));
      controller.enqueue(bytes.slice(11));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function streamingFetch(...turns: Array<Array<[string, unknown]> | number>) {
  const calls: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    const turn = turns.shift();
    if (typeof turn === 'number') return new Response('{}', { status: turn });
    return sse(turn ?? []);
  });
  return { fetch: fetchMock as unknown as typeof fetch, calls };
}

describe('ChatWidget', () => {
  it('streams a reply, shows a custom message after it, and sends the language and body', async () => {
    const { fetch, calls } = streamingFetch([
      ['delta', { text: 'Your record ' }],
      ['card', { total: 42 }],
      ['delta', { text: 'is ready.' }],
      ['done', { sessionId: 's1', reply: 'Your record is ready.', suggestedReplies: [{ label: 'More', value: 'more', kind: 'option' }] }],
    ]);
    render(
      <ChatWidget
        languages={['en', 'fr']}
        strings={{ en: { title: 'Booking help', starterReplies: ['Find a table'] } }}
        fetch={fetch}
        body={{ tenant: 't1' }}
        customEvents={{ card: (data) => data }}
        renderers={{ card: (message, context) => <div data-testid="card">{`${(message.data as { total: number }).total} latest=${context.isLatest}`}</div> }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Booking help' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Find a table' }));
    await waitFor(() => expect(screen.getByText('Your record is ready.')).toBeTruthy());
    expect(screen.getByTestId('card').textContent).toBe('42 latest=true');
    expect(calls[0]).toEqual({ message: 'Find a table', language: 'en', tenant: 't1', stream: true });
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'next' } });
  });

  it('removes a failed turn and says to wait on a 429', async () => {
    const { fetch } = streamingFetch([['delta', { text: 'Half a rep' }], ['error', { status: 429 }]]);
    render(<ChatWidget languages={['en']} fetch={fetch} />);
    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'hello' } });
    fireEvent.submit(screen.getByPlaceholderText('Type a message…').closest('form')!);
    await waitFor(() => expect(screen.getByText(/receiving a lot of requests/)).toBeTruthy());
    expect(screen.queryByText('Half a rep')).toBeNull();
  });

  it('opens with the welcome, switches language with a reset, and applies the theme inline', async () => {
    const { fetch } = streamingFetch();
    render(
      <ChatWidget
        languages={['en', 'fr']}
        welcomeMessage={{ en: 'Hello.', fr: 'Bonjour.' }}
        strings={{ fr: { title: 'Aide' } }}
        theme={{ primaryColor: '#639e30', font: 'Inter' }}
        fetch={fetch}
      />,
    );
    await waitFor(() => expect(screen.getByText('Hello.')).toBeTruthy());
    expect((screen.getByRole('heading').getAttribute('style') ?? '').replace(/\s/g, '')).toContain('color:rgb(99,158,48)');
    fireEvent.click(screen.getByRole('button', { name: 'FR' }));
    await waitFor(() => expect(screen.getByText('Bonjour.')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Aide' })).toBeTruthy();
    expect(screen.queryByText('Hello.')).toBeNull();
    expect(screen.getByRole('button', { name: 'FR' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('uses the class a host gives a slot and the default class elsewhere', () => {
    const { container } = render(<ChatWidget languages={['en']} fetch={streamingFetch().fetch} classNames={{ root: 'host-root' }} />);
    expect(container.firstElementChild?.className).toBe('host-root');
    expect(container.querySelector('header')?.className).toBe('gc-header');
  });
});

describe('useGroundedChat', () => {
  function Harness({ fetch }: { fetch: typeof globalThis.fetch }) {
    const chat = useGroundedChat({ fetch, errorText: (status) => `error ${status ?? 'none'}` });
    return (
      <div>
        <button onClick={() => void chat.sendMessage('hi')}>send</button>
        <button onClick={() => chat.reset()}>reset</button>
        <p data-testid="state">{JSON.stringify({ messages: chat.messages, sessionId: chat.sessionId, error: chat.error })}</p>
      </div>
    );
  }

  it('keeps the session id from done and forgets it on reset', async () => {
    const { fetch, calls } = streamingFetch([['done', { sessionId: 's9', reply: 'One.' }]], [['done', { sessionId: 's9', reply: 'Two.' }]]);
    render(<Harness fetch={fetch} />);
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('"sessionId":"s9"'));
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(calls[1]).toMatchObject({ sessionId: 's9' }));
    act(() => fireEvent.click(screen.getByText('reset')));
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({ messages: [] });
  });

  it('shows the error text with the status of a refused request, and drops a stream that ends without done', async () => {
    const refused = streamingFetch(503);
    const { unmount } = render(<Harness fetch={refused.fetch} />);
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('error 503'));
    unmount();
    const cut = streamingFetch([['delta', { text: 'partial' }]]);
    render(<Harness fetch={cut.fetch} />);
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toContain('error none'));
    expect(screen.getByTestId('state').textContent).not.toContain('partial');
  });
});

describe('playground and styles', () => {
  it('shows a dash until the stats load, then the counts', async () => {
    const fetch = vi.fn(async () => Response.json({ attempts: 7, held: 2 })) as unknown as typeof globalThis.fetch;
    render(
      <Playground title="Try to make it fail" intro="Every message is scored." stats={<PlaygroundStats statsUrl="/stats" figures={[['Attempts', 'attempts'], ['Caught', 'held'], ['Off topic', 'offTopic']]} fetch={fetch} />}>
        <p>chat</p>
      </Playground>,
    );
    expect(screen.getByRole('heading', { name: 'Try to make it fail' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
    expect(screen.getByText('–')).toBeTruthy();
  });

  it('ships a stylesheet written against CSS variables', () => {
    const { container } = render(<GroundedChatStyles />);
    expect(container.querySelector('style')?.textContent).toBe(GROUNDED_CHAT_CSS);
    expect(GROUNDED_CHAT_CSS).toContain('var(--gc-primary)');
  });
});
