/**
 * React chat UI: the `useGroundedChat` hook for any UI, a ready-made `ChatWidget` with a renderer
 * map for a pack's own messages, and the playground frame. Styled only through `classNames` slots
 * and CSS variables; React 19 is a peer dependency.
 */
export {
  useGroundedChat,
  type ChatDoneEvent,
  type ChatMessageView,
  type CustomMessageView,
  type GroundedChat,
  type TextMessageView,
  type UseGroundedChatOptions,
} from './use-grounded-chat.js';
export { ChatWidget, type ChatWidgetProps, type MessageRenderer, type RendererContext, type WidgetTheme } from './chat-widget.js';
export { DEFAULT_WIDGET_CLASSES, type WidgetClassNames } from './class-names.js';
export { DEFAULT_WIDGET_STRINGS, FRENCH_WIDGET_STRINGS, type WidgetStrings } from './strings.js';
export { Toast } from './toast.js';
export { GROUNDED_CHAT_CSS, GroundedChatStyles } from './styles.js';
export {
  Playground,
  PlaygroundStats,
  type PlaygroundClassNames,
  type PlaygroundFigure,
  type PlaygroundStatsClassNames,
} from './playground.js';
