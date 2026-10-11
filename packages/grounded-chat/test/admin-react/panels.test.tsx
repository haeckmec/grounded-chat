// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConfigHandlers, InMemoryConfigStore, type ConfigValidator } from '../../src/admin/index.js';
import {
  AdminClassNamesProvider,
  AdminShell,
  ComplianceThemePanel,
  ConversationPanel,
  DEFAULT_CONVERSATION_COPY,
  InfoTooltip,
  loadTranscript,
  ModelPanel,
  TranscriptView,
} from '../../src/admin-react/index.js';

afterEach(cleanup);

const anything: ConfigValidator = { safeParse: (value) => ({ success: true, data: value }) };

/** A fetch that serves the real config handlers from memory, so the panels talk to what ships. */
function adminBackend(extra: (url: string, init?: RequestInit) => Response | undefined = () => undefined) {
  const store = new InMemoryConfigStore();
  const handlers = createConfigHandlers({ authorize: () => true, store, validators: { conversation: anything, model: anything, complianceTheme: anything } });
  const calls: Array<{ url: string; init?: RequestInit | undefined }> = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const other = extra(url, init);
    if (other) return other;
    const key = url.split('/').pop()!;
    const request = new Request(`http://admin.test${url}`, init);
    return init?.method === 'PUT' ? handlers.PUT(request, key) : handlers.GET(request, key);
  }) as unknown as typeof globalThis.fetch;
  return { fetch, store, calls };
}

const CONVERSATION = {
  welcomeMessage: { en: 'Hello', fr: 'Bonjour' },
  quickReplies: { en: ['Start'], fr: ['Commencer'] },
  fallbackText: { en: 'Sorry', fr: 'Désolé' },
  humanHandoffText: { en: 'Call us', fr: 'Appelez-nous' },
};

describe('ConversationPanel', () => {
  it('loads a legacy plain-string row, edits per language and saves with the ETag', async () => {
    expect(DEFAULT_CONVERSATION_COPY.welcomeMessage.label).toBe('Welcome message');
    const backend = adminBackend();
    await backend.store.set('conversation', { welcomeMessage: 'Old hello' });
    render(<ConversationPanel languages={['en', 'fr']} defaults={CONVERSATION} fetch={backend.fetch} />);
    const welcome = (await screen.findByLabelText(/^Welcome message/)) as HTMLTextAreaElement;
    expect(welcome.value).toBe('Old hello');
    fireEvent.click(screen.getByRole('button', { name: 'FR' }));
    expect((screen.getByLabelText(/^Welcome message/) as HTMLTextAreaElement).value).toBe('Bonjour');
    fireEvent.change(screen.getByLabelText(/^Welcome message/), { target: { value: 'Salut' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect((await backend.store.getRow('conversation'))?.value).toMatchObject({ welcomeMessage: { en: 'Old hello', fr: 'Salut' } });
    const put = backend.calls.find((call) => call.init?.method === 'PUT');
    expect((put?.init?.headers as Record<string, string>)['if-match']).toBeTruthy();
  });

  it("shows the server's reason when another admin saved meanwhile", async () => {
    const backend = adminBackend();
    render(<ConversationPanel languages={['en']} defaults={{ ...CONVERSATION }} fetch={backend.fetch} />);
    await screen.findByRole('button', { name: 'Save' });
    await backend.store.set('conversation', CONVERSATION);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/changed in another tab/);
  });
});

describe('ModelPanel', () => {
  const props = {
    providers: [
      { value: 'dummy', label: 'Dummy' },
      { value: 'live', label: 'Live' },
    ],
    models: [
      { value: '', label: 'Model default' },
      { value: 'fast', label: 'Fast' },
    ],
    defaults: { provider: 'dummy', modelName: '', thinkingLevel: '' as const, maxMessagesPerSession: 40, tokenBudgetPerSession: 20000 },
  };

  it('shows the offline hint for a scripted provider and saves empty choices as absent', async () => {
    const backend = adminBackend();
    render(<ModelPanel {...props} fetch={backend.fetch} />);
    expect((await screen.findAllByDisplayValue('Not used in dummy mode — no LLM call is made.')).length).toBe(3);
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'live' } });
    fireEvent.change(screen.getByLabelText('Model name'), { target: { value: 'fast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect((await backend.store.getRow('model'))?.value).toEqual({ provider: 'live', modelName: 'fast', maxMessagesPerSession: 40, tokenBudgetPerSession: 20000 });
  });
});

describe('ComplianceThemePanel', () => {
  it("edits the pack's localized fields and toggles, the theme, and prunes on demand", async () => {
    const backend = adminBackend((url) => (url === '/api/admin/prune' ? Response.json({ deleted: 4 }) : undefined));
    render(
      <ComplianceThemePanel
        languages={['en', 'fr']}
        defaults={{ disclaimer: { en: 'Indicative', fr: 'Indicatif' }, retentionDays: 30, emailOffer: false, theme: { logoUrl: '', primaryColor: '', font: '' } }}
        localizedFields={[{ key: 'disclaimer', copy: { label: 'Disclaimer' } }]}
        toggles={[{ key: 'emailOffer', label: 'Offer email' }]}
        fetch={backend.fetch}
      />,
    );
    fireEvent.change(await screen.findByLabelText('Disclaimer'), { target: { value: 'Estimate' } });
    fireEvent.click(screen.getByLabelText('Offer email'));
    fireEvent.change(screen.getByLabelText('Primary colour'), { target: { value: '#639e30' } });
    fireEvent.change(screen.getByLabelText('Font family'), { target: { value: 'Poppins' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prune now' }));
    await screen.findByText('Pruned 4 message(s).');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect((await backend.store.getRow('complianceTheme'))?.value).toEqual({
      disclaimer: { en: 'Estimate', fr: 'Indicatif' },
      retentionDays: 30,
      emailOffer: true,
      theme: { logoUrl: '', primaryColor: '#639e30', font: 'Poppins' },
    });
  });
});

describe('transcripts, shell and classes', () => {
  it('loads a transcript and shows each state', async () => {
    const fetch = vi.fn(async () => Response.json({ messages: [{ role: 'user', content: 'hi', createdAt: 't' }] })) as unknown as typeof globalThis.fetch;
    const loaded = await loadTranscript(fetch, 's1');
    expect(loaded).toEqual({ status: 'loaded', messages: [{ role: 'user', content: 'hi', createdAt: 't' }] });
    expect(fetch).toHaveBeenCalledWith('/api/admin/sessions/s1/messages');
    const failing = vi.fn(async () => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
    expect(await loadTranscript(failing, 's1')).toEqual({ status: 'error' });

    const { rerender } = render(<TranscriptView transcript={{ status: 'loading' }} />);
    expect(screen.getByText('Loading transcript…')).toBeTruthy();
    rerender(<TranscriptView transcript={{ status: 'loaded', messages: [] }} />);
    expect(screen.getByText(/may have been pruned/)).toBeTruthy();
    rerender(<TranscriptView transcript={loaded} />);
    expect(screen.getByText('hi')).toBeTruthy();
  });

  it('switches tabs and applies the classes a host provides', () => {
    render(
      <AdminClassNamesProvider value={{ shell: 'host-shell', tabActive: 'is-active' }}>
        <AdminShell
          title="Admin"
          tabs={[
            { id: 'a', label: 'First', render: () => <p>first panel</p> },
            { id: 'b', label: 'Second', render: () => <p>second panel <InfoTooltip text="Help" /></p> },
          ]}
        />
      </AdminClassNamesProvider>,
    );
    expect(screen.getByRole('main').className).toBe('host-shell');
    expect(screen.getByRole('button', { name: 'First' }).className).toBe('gc-admin-tab is-active');
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(screen.getByText(/second panel/)).toBeTruthy();
    expect(screen.getByTitle('Help').getAttribute('aria-hidden')).toBe('true');
  });
});

it('the panels wait for their row before rendering the form', async () => {
  let release: (response: Response) => void = () => {};
  const fetch = vi.fn(() => new Promise<Response>((resolve) => (release = resolve))) as unknown as typeof globalThis.fetch;
  render(<ConversationPanel languages={['en']} defaults={CONVERSATION} fetch={fetch} />);
  expect(screen.getByText('Loading…')).toBeTruthy();
  release(Response.json({ key: 'conversation', value: null }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy());
});
