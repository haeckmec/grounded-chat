/** Interface text the widget writes itself. A pack's own copy, such as its title, overrides these. */
export interface WidgetStrings {
  title: string;
  placeholder: string;
  send: string;
  refreshChat: string;
  /** The accessible name of the language switch. */
  languageLabel: string;
  starterLabel: string;
  starterReplies: string[];
  /** Shown while waiting for the first text of a reply. */
  typing: string;
  errorMessage: string;
  rateLimitMessage: string;
}

/** The English interface text; `FRENCH_WIDGET_STRINGS` is the French. */
export const DEFAULT_WIDGET_STRINGS: WidgetStrings = {
  title: 'Assistant',
  placeholder: 'Type a message…',
  send: 'Send',
  refreshChat: 'Refresh chat',
  languageLabel: 'Language',
  starterLabel: 'Try asking:',
  starterReplies: [],
  typing: '…',
  errorMessage: 'Something went wrong — please try again.',
  rateLimitMessage: 'This assistant is receiving a lot of requests right now — please wait a moment and try again.',
};

/** French for every generic string; a pack still brings its own title and starter replies. */
export const FRENCH_WIDGET_STRINGS: WidgetStrings = {
  title: 'Assistant',
  placeholder: 'Écrivez un message…',
  send: 'Envoyer',
  refreshChat: 'Nouvelle conversation',
  languageLabel: 'Langue',
  starterLabel: 'Essayez de demander :',
  starterReplies: [],
  typing: '…',
  errorMessage: 'Une erreur est survenue — veuillez réessayer.',
  rateLimitMessage: 'Cet assistant reçoit beaucoup de demandes en ce moment — merci de patienter un instant avant de réessayer.',
};
