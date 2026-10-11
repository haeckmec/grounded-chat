// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SECRET_KEY_PATTERN } from '../../src/admin/index.js';
import {
  AdminClassNamesProvider,
  DEFAULT_ADMIN_CLASSES,
  LanguageToggle,
  LoadingPlaceholder,
  SaveRow,
  useAdminClasses,
  useConfigPanel,
} from '../../src/admin-react/index.js';

afterEach(cleanup);

describe('admin primitives', () => {
  it('give every slot a gc-admin- class, overridable per slot', () => {
    for (const value of Object.values(DEFAULT_ADMIN_CLASSES)) expect(value).toMatch(/^gc-admin-/);
    function Probe() {
      const classes = useAdminClasses();
      return <p className={classes.hint}>{classes.loading}</p>;
    }
    render(
      <AdminClassNamesProvider value={{ hint: 'host-hint' }}>
        <Probe />
      </AdminClassNamesProvider>,
    );
    expect(screen.getByText('gc-admin-loading').className).toBe('host-hint');
  });

  it('toggles the editing language', () => {
    function Harness() {
      const [lang, setLang] = useState<'en' | 'fr'>('en');
      return <LanguageToggle value={lang} onChange={setLang} languages={['en', 'fr']} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'FR' }));
    expect(screen.getByRole('button', { name: 'FR' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Editing language' })).toBeTruthy();
  });

  it('shows a placeholder, and a save row with its outcome', () => {
    const onSave = vi.fn();
    render(
      <>
        <LoadingPlaceholder />
        <SaveRow onSave={onSave} saved saveError="Conflict." />
      </>,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.getByText('Saved.')).toBeTruthy();
    expect(screen.getByText('Conflict.')).toBeTruthy();
  });

  it('useConfigPanel reads the row and its ETag, then saves with If-Match', async () => {
    const calls: Array<{ url: string; init?: RequestInit | undefined }> = [];
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return init?.method === 'PUT' ? Response.json({}, { headers: { etag: 'e2' } }) : Response.json({ value: { name: 'saved' } }, { headers: { etag: 'e1' } });
    }) as unknown as typeof globalThis.fetch;
    function Harness() {
      const panel = useConfigPanel('model', { name: 'default' }, { fetch, baseUrl: '/admin/config' });
      return panel.loaded ? <button onClick={() => void panel.save({ name: 'next' })}>{panel.value.name}</button> : null;
    }
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'saved' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]!.url).toBe('/admin/config/model');
    expect(calls[1]!.init).toMatchObject({ method: 'PUT', headers: { 'if-match': 'e1' }, body: '{"name":"next"}' });
  });

  it('the secret pattern matches credential names only', () => {
    expect(SECRET_KEY_PATTERN.test('apiKey')).toBe(true);
    expect(SECRET_KEY_PATTERN.test('tokenBudgetPerSession')).toBe(false);
  });
});
