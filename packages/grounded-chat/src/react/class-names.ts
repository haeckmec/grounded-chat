/** Every element of the widget a host can style, by slot. */
export interface WidgetClassNames {
  root: string;
  header: string;
  brand: string;
  logo: string;
  title: string;
  actions: string;
  resetButton: string;
  languageGroup: string;
  /** Every language button; joined with the active or inactive slot. */
  languageButton: string;
  languageButtonActive: string;
  languageButtonInactive: string;
  messages: string;
  rowUser: string;
  rowAssistant: string;
  /** Every text bubble; joined with the user or assistant slot. */
  bubble: string;
  bubbleUser: string;
  bubbleAssistant: string;
  typing: string;
  error: string;
  replies: string;
  repliesLabel: string;
  pills: string;
  pill: string;
  /** A suggested reply that asks about the options rather than choosing one. */
  pillExplain: string;
  composer: string;
  input: string;
  sendButton: string;
  toastOuter: string;
  toast: string;
}

/** `gc-` classes the default stylesheet styles through CSS variables. */
export const DEFAULT_WIDGET_CLASSES: WidgetClassNames = {
  root: 'gc-root',
  header: 'gc-header',
  brand: 'gc-brand',
  logo: 'gc-logo',
  title: 'gc-title',
  actions: 'gc-actions',
  resetButton: 'gc-reset',
  languageGroup: 'gc-languages',
  languageButton: 'gc-language',
  languageButtonActive: 'gc-language-active',
  languageButtonInactive: 'gc-language-inactive',
  messages: 'gc-messages',
  rowUser: 'gc-row gc-row-user',
  rowAssistant: 'gc-row gc-row-assistant',
  bubble: 'gc-bubble',
  bubbleUser: 'gc-bubble-user',
  bubbleAssistant: 'gc-bubble-assistant',
  typing: 'gc-typing',
  error: 'gc-error',
  replies: 'gc-replies',
  repliesLabel: 'gc-replies-label',
  pills: 'gc-pills',
  pill: 'gc-pill',
  pillExplain: 'gc-pill gc-pill-explain',
  composer: 'gc-composer',
  input: 'gc-input',
  sendButton: 'gc-send',
  toastOuter: 'gc-toast-outer',
  toast: 'gc-toast',
};
