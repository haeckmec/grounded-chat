import { Fragment, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { googleFontsHref } from '../client/fonts.js';
import type { QuickReply } from '../intake/plan.js';
import { DEFAULT_WIDGET_CLASSES, type WidgetClassNames } from './class-names.js';
import { DEFAULT_WIDGET_STRINGS, type WidgetStrings } from './strings.js';
import { Toast } from './toast.js';
import { useGroundedChat, type ChatMessageView, type CustomMessageView } from './use-grounded-chat.js';

/** The theme a host passes: colours and font as concrete values. */
export interface WidgetTheme {
  logoUrl?: string | undefined;
  primaryColor?: string | undefined;
  font?: string | undefined;
}

/** What a custom message renderer gets besides its message. */
export interface RendererContext<L extends string = string> {
  /** The message's position in the transcript. */
  index: number;
  /** True when no later message of the same name follows it. */
  isLatest: boolean;
  language: L;
  theme: WidgetTheme | undefined;
  sessionId: string | undefined;
  showToast(message: string): void;
}

/** Renders one custom message, by the stream event name that carried it. */
export type MessageRenderer<L extends string = string> = (message: CustomMessageView, context: RendererContext<L>) => ReactNode;

/** Props of `ChatWidget`; `L` is the union of the language codes it offers. */
export interface ChatWidgetProps<L extends string = string> {
  /** The languages the header offers, in order; the first is the default. */
  languages: readonly L[];
  initialLanguage?: L | undefined;
  /** Interface text per language; missing keys fall back to the English defaults. */
  strings?: Partial<Record<L, Partial<WidgetStrings>>>;
  /** A welcome the conversation opens with, per language. */
  welcomeMessage?: Partial<Record<L, string>> | undefined;
  /** Starter questions shown before the first message, per language. */
  starterReplies?: Partial<Record<L, string[]>> | undefined;
  theme?: WidgetTheme | undefined;
  /** Classes per element; a slot left out keeps its default class. */
  classNames?: Partial<WidgetClassNames>;
  renderers?: Record<string, MessageRenderer<L>>;
  /** Maps a stream event besides delta, done and error to a custom message's data. */
  customEvents?: Record<string, (data: unknown) => unknown>;
  endpoint?: string;
  /** Extra fields for every turn; the current language is always sent as `language`. */
  body?: Record<string, unknown>;
  /** The host's fetch, usually the global one; the package makes no network call of its own. */
  fetch: typeof fetch;
}

const MAX_TEXTAREA_HEIGHT = 144; // about 6 lines before the field scrolls internally
const TOAST_DURATION_MS = 3000;

function join(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function isLatestOfName(messages: ChatMessageView[], index: number): boolean {
  const message = messages[index];
  if (message?.type !== 'custom') return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const candidate = messages[i];
    if (candidate?.type === 'custom' && candidate.name === message.name) return i === index;
  }
  return false;
}

/**
 * A ready-made chat: header with title, reset and language switch; the transcript with custom
 * renderers; starter and suggested replies; the composer. Unstyled except through `classNames` and
 * CSS variables (see `GroundedChatStyles`); the theme's colour and font apply as inline styles.
 */
export function ChatWidget<L extends string>(props: ChatWidgetProps<L>) {
  const { languages, theme } = props;
  const [language, setLanguage] = useState<L>(props.initialLanguage ?? (languages[0] as L));
  const [input, setInput] = useState('');
  const [toast, setToast] = useState<string | undefined>(undefined);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Read where a closure would otherwise freeze an older language, such as a welcome that loads
  // after the user already switched.
  const languageRef = useRef<L>(language);
  languageRef.current = language;

  const classes = { ...DEFAULT_WIDGET_CLASSES, ...props.classNames };
  const t: WidgetStrings = { ...DEFAULT_WIDGET_STRINGS, ...props.strings?.[language] };
  const welcomeFor = (lang: L): ChatMessageView[] => {
    const welcome = props.welcomeMessage?.[lang];
    return welcome ? [{ type: 'text', role: 'assistant', content: welcome }] : [];
  };

  const chat = useGroundedChat({
    ...(props.endpoint ? { endpoint: props.endpoint } : {}),
    fetch: props.fetch,
    ...(props.customEvents ? { customEvents: props.customEvents } : {}),
    body: () => ({ language: languageRef.current, ...props.body }),
    errorText: (status) => (status === 429 ? t.rateLimitMessage : t.errorMessage),
    initialMessages: () => welcomeFor(languageRef.current),
  });

  const welcomeNow = props.welcomeMessage?.[language];
  const { seedIfEmpty } = chat;
  useEffect(() => {
    if (welcomeNow) seedIfEmpty([{ type: 'text', role: 'assistant', content: welcomeNow }]);
  }, [welcomeNow, seedIfEmpty]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  // A theme font from the curated list needs its stylesheet loaded; anything else is left to the
  // host's own font stack.
  useEffect(() => {
    const href = googleFontsHref(theme?.font);
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [theme?.font]);

  useEffect(() => {
    // Scrolling the container to its own height leaves no gap from its bottom padding, unlike
    // scrollIntoView on a sentinel child.
    scrollContainerRef.current?.scrollTo?.({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, chat.loading]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(undefined), TOAST_DURATION_MS);
  }

  function resetChat(overrideLanguage?: L) {
    chat.reset(welcomeFor(overrideLanguage ?? language));
    setInput('');
  }

  function send(text: string) {
    if (!text.trim() || chat.loading) return;
    setInput('');
    void chat.sendMessage(text);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  }

  const accentStyle: CSSProperties | undefined = theme?.primaryColor ? { backgroundColor: theme.primaryColor } : undefined;
  const accentTextStyle: CSSProperties | undefined = theme?.primaryColor ? { color: theme.primaryColor } : undefined;
  const fontStyle: CSSProperties | undefined = theme?.font ? { fontFamily: `${theme.font}, sans-serif` } : undefined;

  const hasUserMessage = chat.messages.some((m) => m.type === 'text' && m.role === 'user');
  const configuredStarters = props.starterReplies?.[language];
  const starters = configuredStarters && configuredStarters.length > 0 ? configuredStarters : t.starterReplies;
  const suggested: QuickReply[] | undefined = chat.suggestedReplies;

  return (
    <div className={classes.root} style={fontStyle}>
      <header className={classes.header}>
        <div className={classes.brand}>
          {theme?.logoUrl && <img src={theme.logoUrl} alt="" className={classes.logo} />}
          <h1 className={classes.title} style={accentTextStyle}>
            {t.title}
          </h1>
        </div>
        <div className={classes.actions}>
          <button type="button" onClick={() => resetChat()} className={classes.resetButton}>
            {t.refreshChat}
          </button>
          {languages.length > 1 && (
            <div className={classes.languageGroup} role="group" aria-label={t.languageLabel}>
              {languages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    if (lang !== language) {
                      setLanguage(lang);
                      // The new language is passed on: the state update has not landed this tick.
                      resetChat(lang);
                    }
                  }}
                  className={join(classes.languageButton, language === lang ? classes.languageButtonActive : classes.languageButtonInactive)}
                  style={language === lang ? accentStyle : undefined}
                  aria-pressed={language === lang}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div ref={scrollContainerRef} className={classes.messages}>
        {chat.messages.map((message, index) => {
          if (message.type === 'custom') {
            const render = props.renderers?.[message.name];
            if (!render) return null;
            return (
              <Fragment key={`${message.name}-${index}`}>
                {render(message, {
                  index,
                  isLatest: isLatestOfName(chat.messages, index),
                  language,
                  theme,
                  sessionId: chat.sessionId,
                  showToast,
                })}
              </Fragment>
            );
          }
          if (message.role === 'assistant' && !message.content) return null;
          const isUser = message.role === 'user';
          return (
            <div key={index} className={isUser ? classes.rowUser : classes.rowAssistant}>
              <span className={join(classes.bubble, isUser ? classes.bubbleUser : classes.bubbleAssistant)} style={isUser ? accentStyle : undefined}>
                {message.content}
              </span>
            </div>
          );
        })}

        {chat.loading && !chat.streaming && <p className={classes.typing}>{t.typing}</p>}
        {chat.error && <p className={classes.error}>{chat.error}</p>}
      </div>

      {!hasUserMessage && (
        <div className={classes.replies}>
          <p className={classes.repliesLabel}>{t.starterLabel}</p>
          <div className={classes.pills}>
            {starters.map((reply) => (
              <button key={reply} type="button" onClick={() => send(reply)} className={classes.pill}>
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasUserMessage && suggested && suggested.length > 0 && (
        <div className={classes.replies}>
          <div className={classes.pills}>
            {suggested.map((reply) => (
              <button
                key={reply.label}
                type="button"
                onClick={() => send(reply.value)}
                className={reply.kind === 'explain' ? classes.pillExplain : classes.pill}
              >
                {reply.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={classes.composer}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t.placeholder}
          className={classes.input}
        />
        <button type="submit" disabled={chat.loading || input.trim().length === 0} className={classes.sendButton} style={accentStyle}>
          {t.send}
        </button>
      </form>

      {toast && <Toast message={toast} classNames={classes} />}
    </div>
  );
}
