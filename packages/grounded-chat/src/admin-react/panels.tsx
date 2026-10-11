import { useState, type ReactNode } from 'react';
import { FONT_OPTIONS } from '../client/fonts.js';
import { coerceLocalizedList, coerceLocalizedText, type LocalizedList, type LocalizedText } from '../admin/localized.js';
import { join, useAdminClasses } from './class-names.js';
import { InfoTooltip, LanguageToggle, LoadingPlaceholder, SaveRow, useConfigPanel } from './primitives.js';

/** A field's label and its hover help. */
export interface FieldCopy {
  label: ReactNode;
  help?: string | undefined;
}

function Label({ copy }: { copy: FieldCopy }) {
  const classes = useAdminClasses();
  return (
    <span className={classes.fieldLabel}>
      {copy.label}
      {copy.help && <InfoTooltip text={copy.help} />}
    </span>
  );
}

/** The conversation texts every chat has, per language. */
export interface ConversationConfig<L extends string = 'en' | 'fr'> {
  [key: string]: unknown;
  welcomeMessage: LocalizedText<L>;
  quickReplies: LocalizedList<L>;
  fallbackText: LocalizedText<L>;
  humanHandoffText: LocalizedText<L>;
}

export interface ConversationPanelCopy {
  editingFor: string;
  reset: string;
  resetTitle: string;
  welcomeMessage: FieldCopy;
  quickReplies: FieldCopy;
  fallbackText: FieldCopy;
  humanHandoffText: FieldCopy;
}

export const DEFAULT_CONVERSATION_COPY: ConversationPanelCopy = {
  editingFor: 'Editing text for:',
  reset: 'Reset to suggested text',
  resetTitle: 'Replaces all four fields below with the suggested starter copy — not saved until you click Save.',
  welcomeMessage: { label: 'Welcome message', help: 'Shown as the first chat bubble before the user types anything. Set every language.' },
  quickReplies: { label: 'Quick replies (one per line)', help: 'Buttons shown above the input before the first message, one per line. Set every language.' },
  fallbackText: { label: 'Fallback text', help: 'Said when the assistant has no answer it can back with a tool result. Set every language.' },
  humanHandoffText: { label: 'Human handoff text', help: 'Said when the user asks to speak to a person. Set every language.' },
};

/**
 * The Conversation tab: welcome message, quick replies, fallback and handoff texts, edited per
 * language, saved to the `conversation` config row. `defaults` are the suggested texts the reset
 * restores and a never-saved row shows.
 */
export function ConversationPanel<L extends string>({
  languages,
  defaults,
  copy = DEFAULT_CONVERSATION_COPY,
  configKey = 'conversation',
  fetch,
}: {
  languages: readonly L[];
  defaults: ConversationConfig<L>;
  copy?: ConversationPanelCopy;
  configKey?: string;
  fetch: typeof globalThis.fetch;
}) {
  const classes = useAdminClasses();
  const { value, setValue, save, saved, saveError, loaded } = useConfigPanel(configKey, defaults, {
    fetch,
    normalize: (raw, base) => {
      const r = raw as Partial<ConversationConfig<L>>;
      return {
        welcomeMessage: coerceLocalizedText(r.welcomeMessage, base.welcomeMessage),
        quickReplies: coerceLocalizedList(r.quickReplies, base.quickReplies),
        fallbackText: coerceLocalizedText(r.fallbackText, base.fallbackText),
        humanHandoffText: coerceLocalizedText(r.humanHandoffText, base.humanHandoffText),
      };
    },
  });
  const [editLang, setEditLang] = useState<L>(languages[0]!);

  if (!loaded) return <LoadingPlaceholder />;

  return (
    <div className={classes.panel}>
      <div className={classes.panelHeader}>
        <p className={classes.hint}>{copy.editingFor}</p>
        <div className={classes.headerActions}>
          <button type="button" onClick={() => setValue(defaults)} className={classes.resetLink} title={copy.resetTitle}>
            {copy.reset}
          </button>
          <LanguageToggle value={editLang} onChange={setEditLang} languages={languages} />
        </div>
      </div>
      <label className={classes.field}>
        <Label copy={copy.welcomeMessage} />
        <textarea
          value={value.welcomeMessage[editLang]}
          onChange={(e) => setValue({ ...value, welcomeMessage: { ...value.welcomeMessage, [editLang]: e.target.value } })}
          className={classes.textarea}
          rows={2}
        />
      </label>
      <label className={classes.field}>
        <Label copy={copy.quickReplies} />
        <textarea
          value={value.quickReplies[editLang].join('\n')}
          onChange={(e) => setValue({ ...value, quickReplies: { ...value.quickReplies, [editLang]: e.target.value.split('\n').filter(Boolean) } })}
          className={classes.textarea}
          rows={3}
        />
      </label>
      <label className={classes.field}>
        <Label copy={copy.fallbackText} />
        <textarea
          value={value.fallbackText[editLang]}
          onChange={(e) => setValue({ ...value, fallbackText: { ...value.fallbackText, [editLang]: e.target.value } })}
          className={classes.textarea}
          rows={2}
        />
      </label>
      <label className={classes.field}>
        <Label copy={copy.humanHandoffText} />
        <input
          value={value.humanHandoffText[editLang]}
          onChange={(e) => setValue({ ...value, humanHandoffText: { ...value.humanHandoffText, [editLang]: e.target.value } })}
          className={classes.input}
        />
      </label>
      <SaveRow onSave={() => void save()} saved={saved} saveError={saveError} />
    </div>
  );
}

/** One choice in a select. */
export interface Option {
  value: string;
  label: string;
}

/** The model settings every chat has. Empty strings mean "the default"; they are saved as absent. */
export interface ModelConfig {
  [key: string]: unknown;
  provider: string;
  modelName: string;
  thinkingLevel: '' | 'minimal' | 'low' | 'medium' | 'high';
  maxMessagesPerSession: number;
  tokenBudgetPerSession: number;
}

/**
 * The Model tab: provider, model, thinking level, message cap and token budget, saved to the `model`
 * config row. A provider listed in `offlineProviders` (a scripted dummy) makes no model call, so its
 * model fields show `offlineHint` instead.
 */
export function ModelPanel({
  providers,
  models,
  defaults,
  offlineProviders = ['dummy'],
  offlineHint = 'Not used in dummy mode — no LLM call is made.',
  configKey = 'model',
  fetch,
}: {
  providers: Option[];
  /** The model choices; the first is usually "model default" with an empty value. */
  models: Option[];
  defaults: ModelConfig;
  offlineProviders?: readonly string[];
  offlineHint?: string;
  configKey?: string;
  fetch: typeof globalThis.fetch;
}) {
  const classes = useAdminClasses();
  const { value, setValue, save, saved, saveError, loaded } = useConfigPanel(configKey, defaults, { fetch });
  const offline = offlineProviders.includes(value.provider);

  if (!loaded) return <LoadingPlaceholder />;

  const hint = <input value={offlineHint} disabled className={classes.inputDisabled} />;
  return (
    <div className={classes.panel}>
      <label className={classes.field}>
        Provider
        <select value={value.provider} onChange={(e) => setValue({ ...value, provider: e.target.value })} className={classes.select}>
          {providers.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={classes.field}>
        Model name
        {offline ? (
          hint
        ) : (
          <select value={value.modelName} onChange={(e) => setValue({ ...value, modelName: e.target.value })} className={classes.select}>
            {models.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className={classes.field}>
        Thinking level
        {offline ? (
          hint
        ) : (
          <select
            value={value.thinkingLevel}
            onChange={(e) => setValue({ ...value, thinkingLevel: e.target.value as ModelConfig['thinkingLevel'] })}
            className={classes.select}
          >
            <option value="">Model default</option>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        )}
      </label>
      <label className={classes.field}>
        Max messages per session
        <input
          type="number"
          min={1}
          value={value.maxMessagesPerSession}
          onChange={(e) => setValue({ ...value, maxMessagesPerSession: Number(e.target.value) })}
          className={classes.input}
        />
      </label>
      <label className={classes.field}>
        Token budget per session
        {offline ? (
          hint
        ) : (
          <input
            type="number"
            min={1}
            value={value.tokenBudgetPerSession}
            onChange={(e) => setValue({ ...value, tokenBudgetPerSession: Number(e.target.value) })}
            className={classes.input}
          />
        )}
      </label>
      <SaveRow
        onSave={() =>
          void save({
            modelName: value.modelName === '' ? undefined : value.modelName,
            thinkingLevel: value.thinkingLevel === '' ? undefined : value.thinkingLevel,
          } as Partial<ModelConfig>)
        }
        saved={saved}
        saveError={saveError}
      />
    </div>
  );
}

/** The theme every chat has: logo, primary colour and font. Empty means the neutral default. */
export interface ThemeConfig {
  logoUrl: string;
  primaryColor: string;
  font: string;
}

/** A per-language text field the pack adds to the panel, such as a disclaimer. */
export interface LocalizedFieldSpec {
  key: string;
  copy: FieldCopy;
}

/** A yes/no setting the pack adds, such as offering an email field. */
export interface ToggleSpec {
  key: string;
  label: ReactNode;
  help?: string;
}

export interface ThemePanelConfig {
  [key: string]: unknown;
  retentionDays: number;
  theme: ThemeConfig;
}

/**
 * The compliance and theme tab. The generic half is here: transcript retention with a prune button,
 * and the theme (logo, primary colour, font). The pack brings its own compliance copy as
 * `localizedFields` (edited per language in a box of their own, with a reset to `defaults`) and its
 * own `toggles`.
 */
export function ComplianceThemePanel<L extends string, T extends ThemePanelConfig>({
  languages,
  defaults,
  localizedFields = [],
  localizedNote = 'Text per language — the toggle below applies to these fields only:',
  resetTitle = 'Replaces these fields with the suggested starter copy — not saved until you click Save.',
  toggles = [],
  retentionHelp = 'Chat messages older than this are deleted by the retention sweep and by "Prune now".',
  themeHelp = 'Logo URL, primary colour and font apply live to the chat widget. Leave any of the three blank to keep the neutral default for that piece.',
  pruneUrl = '/api/admin/prune',
  configKey = 'complianceTheme',
  fetch,
}: {
  languages: readonly L[];
  defaults: T;
  localizedFields?: LocalizedFieldSpec[];
  localizedNote?: string;
  resetTitle?: string;
  toggles?: ToggleSpec[];
  retentionHelp?: string;
  themeHelp?: string;
  pruneUrl?: string;
  configKey?: string;
  fetch: typeof globalThis.fetch;
}) {
  const classes = useAdminClasses();
  const { value, setValue, save, saved, saveError, loaded } = useConfigPanel(configKey, defaults, {
    fetch,
    normalize: (raw, base) => {
      const r = raw as Partial<T>;
      return {
        ...base,
        ...r,
        ...Object.fromEntries(localizedFields.map((field) => [field.key, coerceLocalizedText(r[field.key], base[field.key] as LocalizedText<L>)])),
        // Field by field: a row saved before a theme field existed would leave its input uncontrolled.
        theme: { ...base.theme, ...(r.theme ?? {}) },
      } as T;
    },
  });
  const [editLang, setEditLang] = useState<L>(languages[0]!);
  const [pruneResult, setPruneResult] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  async function prune() {
    setPruning(true);
    setPruneResult(null);
    try {
      const response = await fetch(pruneUrl, { method: 'POST' });
      const data = (await response.json()) as { deleted?: number; error?: string };
      setPruneResult(response.ok ? `Pruned ${data.deleted} message(s).` : (data.error ?? null));
    } finally {
      setPruning(false);
    }
  }

  if (!loaded) return <LoadingPlaceholder />;

  const setTheme = (patch: Partial<ThemeConfig>) => setValue({ ...value, theme: { ...value.theme, ...patch } });

  return (
    <div className={classes.panel}>
      {localizedFields.length > 0 && (
        <div className={classes.localizedBox}>
          <div className={classes.panelHeader}>
            <p className={classes.localizedNote}>{localizedNote}</p>
            <div className={classes.headerActions}>
              <button
                type="button"
                onClick={() => setValue({ ...value, ...Object.fromEntries(localizedFields.map((field) => [field.key, defaults[field.key]])) })}
                className={classes.resetLink}
                title={resetTitle}
              >
                Reset to suggested text
              </button>
              <LanguageToggle value={editLang} onChange={setEditLang} languages={languages} />
            </div>
          </div>
          {localizedFields.map((field) => {
            const text = value[field.key] as LocalizedText<L>;
            return (
              <label key={field.key} className={classes.field}>
                <Label copy={field.copy} />
                <textarea
                  value={text[editLang]}
                  onChange={(e) => setValue({ ...value, [field.key]: { ...text, [editLang]: e.target.value } })}
                  className={classes.localizedTextarea}
                  rows={2}
                />
              </label>
            );
          })}
        </div>
      )}
      <div className={classes.inlineRow}>
        <label className={classes.inlineField}>
          <Label copy={{ label: 'Transcript retention (days)', help: retentionHelp }} />
          <input
            type="number"
            min={1}
            value={value.retentionDays}
            onChange={(e) => setValue({ ...value, retentionDays: Number(e.target.value) })}
            className={classes.input}
          />
        </label>
        <button onClick={() => void prune()} disabled={pruning} className={classes.secondaryButton}>
          {pruning ? 'Pruning…' : 'Prune now'}
        </button>
      </div>
      {pruneResult && <p className={classes.result}>{pruneResult}</p>}
      {toggles.map((toggle) => (
        <label key={toggle.key} className={classes.checkboxField}>
          <input type="checkbox" checked={Boolean(value[toggle.key])} onChange={(e) => setValue({ ...value, [toggle.key]: e.target.checked })} />
          {toggle.label}
          {toggle.help && <InfoTooltip text={toggle.help} />}
        </label>
      ))}

      <h2 className={classes.sectionTitle}>
        Theme
        <InfoTooltip text={themeHelp} />
      </h2>
      <label className={classes.field}>
        Logo URL
        <input value={value.theme.logoUrl} onChange={(e) => setTheme({ logoUrl: e.target.value })} className={classes.input} placeholder="https://example.com/logo.png" />
      </label>
      <label className={classes.field}>
        Primary colour
        <input value={value.theme.primaryColor} onChange={(e) => setTheme({ primaryColor: e.target.value })} className={classes.input} placeholder="#2563eb" />
      </label>
      <label className={classes.field}>
        Font family
        <select value={value.theme.font} onChange={(e) => setTheme({ font: e.target.value })} className={classes.selectWide}>
          <option value="">Neutral default</option>
          {FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <SaveRow onSave={() => void save()} saved={saved} saveError={saveError} />
    </div>
  );
}

/** One persisted message of a transcript. */
export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type TranscriptState = { status: 'loading' } | { status: 'loaded'; messages: TranscriptMessage[] } | { status: 'error' };

/** Loads one session's transcript from the `/admin` transcript handler. */
export async function loadTranscript(fetch: typeof globalThis.fetch, sessionId: string, baseUrl = '/api/admin/sessions'): Promise<TranscriptState> {
  try {
    const response = await fetch(`${baseUrl}/${sessionId}/messages`);
    const data = (await response.json()) as { messages?: TranscriptMessage[] };
    return { status: 'loaded', messages: data.messages ?? [] };
  } catch {
    return { status: 'error' };
  }
}

/** One conversation as the admin reads it. An empty transcript says it may have been pruned. */
export function TranscriptView({ transcript }: { transcript?: TranscriptState | undefined }) {
  const classes = useAdminClasses();
  if (!transcript || transcript.status === 'loading') return <p className={classes.transcriptNote}>Loading transcript…</p>;
  if (transcript.status === 'error') return <p className={classes.transcriptError}>Couldn&apos;t load the transcript.</p>;
  if (transcript.messages.length === 0) {
    return <p className={classes.transcriptNote}>No transcript available (may have been pruned by the retention setting).</p>;
  }
  return (
    <div className={classes.transcript}>
      {transcript.messages.map((message, index) => (
        <div key={index} className={message.role === 'user' ? classes.transcriptRowUser : classes.transcriptRowAssistant}>
          <span className={join(classes.transcriptBubble, message.role === 'user' ? classes.transcriptBubbleUser : classes.transcriptBubbleAssistant)}>
            {message.content}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One tab of the admin: its label and what it shows. */
export interface AdminTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

/** The admin frame: a title and tabs. A host mixes its own tabs with the package's panels. */
export function AdminShell({ title, tabs }: { title: string; tabs: AdminTab[] }) {
  const classes = useAdminClasses();
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active);
  return (
    <main className={classes.shell}>
      <h1 className={classes.shellTitle}>{title}</h1>
      <nav className={classes.tabs}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActive(tab.id)} className={join(classes.tab, tab.id === active ? classes.tabActive : classes.tabInactive)}>
            {tab.label}
          </button>
        ))}
      </nav>
      {current?.render()}
    </main>
  );
}
