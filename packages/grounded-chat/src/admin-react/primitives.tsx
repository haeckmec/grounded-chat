import { useEffect, useRef, useState, type ReactNode } from 'react';
import { join, useAdminClasses } from './class-names.js';

/**
 * A hover-explain glyph for a form field: what it affects and what to put in it. Only a `title`, and
 * hidden from assistive technology: the field already has its own label, and a second accessible
 * name here would collide with it in by-label lookups.
 */
export function InfoTooltip({ text }: { text: string }) {
  const classes = useAdminClasses();
  return (
    <span title={text} aria-hidden="true" className={classes.tooltip}>
      i
    </span>
  );
}

/** Which language a localized field is being edited in. */
export function LanguageToggle<L extends string>({
  value,
  onChange,
  languages,
  label = 'Editing language',
}: {
  value: L;
  onChange: (language: L) => void;
  languages: readonly L[];
  label?: string;
}) {
  const classes = useAdminClasses();
  return (
    <div className={classes.languageGroup} role="group" aria-label={label}>
      {languages.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={join(classes.languageButton, value === lang ? classes.languageButtonActive : classes.languageButtonInactive)}
          aria-pressed={value === lang}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Shown instead of a form until its saved value has loaded, so the form never jumps. */
export function LoadingPlaceholder({ text = 'Loading…' }: { text?: string }) {
  return <p className={useAdminClasses().loading}>{text}</p>;
}

/** The save button and its outcome: a brief "Saved." or the server's reason. */
export function SaveRow({ onSave, saved, saveError, label = 'Save' }: { onSave: () => void; saved: boolean; saveError: string | null; label?: ReactNode }) {
  const classes = useAdminClasses();
  return (
    <>
      <button onClick={onSave} className={classes.saveButton}>
        {label}
      </button>
      {saved && <span className={classes.saved}>Saved.</span>}
      {saveError && <span className={classes.saveError}>{saveError}</span>}
    </>
  );
}

export interface ConfigPanelState<T> {
  value: T;
  setValue: (value: T) => void;
  /** Saves the value, with `overrides` applied, guarded by the ETag last loaded or saved. */
  save: (overrides?: Partial<T>) => Promise<void>;
  saved: boolean;
  saveError: string | null;
  loaded: boolean;
}

/**
 * One config row in a form: loads it from the `/admin` config handler, keeps its ETag, and saves
 * with If-Match, so a change made meanwhile in another tab is refused (409) and its message shown
 * instead of overwritten. `normalize` reads a row saved in an older shape.
 */
export function useConfigPanel<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
  options: { fetch: typeof fetch; baseUrl?: string; normalize?: (raw: unknown, defaults: T) => T },
): ConfigPanelState<T> {
  const [value, setValue] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const url = `${options.baseUrl ?? '/api/admin/config'}/${key}`;

  useEffect(() => {
    const doFetch = optionsRef.current.fetch;
    void doFetch(url)
      .then((response) => {
        etagRef.current = response.headers.get('etag');
        return response.json();
      })
      .then((data: { value?: unknown }) => {
        const normalize = optionsRef.current.normalize;
        if (data.value) setValue(normalize ? normalize(data.value, defaults) : { ...defaults, ...(data.value as Partial<T>) });
      })
      // Loaded either way: the caller shows a placeholder until then, so the form never paints
      // the defaults first and jumps to the saved value.
      .catch(() => {})
      .finally(() => setLoaded(true));
    // The defaults are a first-render value; a new object each render must not refetch.
  }, [url]);

  async function save(overrides?: Partial<T>) {
    setSaveError(null);
    const doFetch = optionsRef.current.fetch;
    const response = await doFetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...(etagRef.current !== null ? { 'if-match': etagRef.current } : {}) },
      body: JSON.stringify({ ...value, ...overrides }),
    });
    if (response.ok) {
      etagRef.current = response.headers.get('etag') ?? etagRef.current;
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      const data = (await response.json().catch(() => ({}))) as { error?: unknown };
      setSaveError(typeof data.error === 'string' ? data.error : "Couldn't save — please try again.");
    }
  }

  return { value, setValue, save, saved, saveError, loaded };
}
