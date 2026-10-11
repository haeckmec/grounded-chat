/**
 * Admin panels as React components: the shell with tabs, Conversation, Model, and the compliance and
 * theme tab whose compliance copy the pack supplies, the transcript viewer, and the primitives a
 * host's own panels reuse. Each talks to the `/admin` handlers through the host's `fetch`, behind
 * the host's own login. Styled through one class map (`AdminClassNamesProvider`).
 */
export {
  AdminClassNamesProvider,
  DEFAULT_ADMIN_CLASSES,
  useAdminClasses,
  type AdminClassNames,
} from './class-names.js';
export { InfoTooltip, LanguageToggle, LoadingPlaceholder, SaveRow, useConfigPanel, type ConfigPanelState } from './primitives.js';
export {
  AdminShell,
  ComplianceThemePanel,
  ConversationPanel,
  DEFAULT_CONVERSATION_COPY,
  loadTranscript,
  ModelPanel,
  TranscriptView,
  type AdminTab,
  type ConversationConfig,
  type ConversationPanelCopy,
  type FieldCopy,
  type LocalizedFieldSpec,
  type ModelConfig,
  type Option,
  type ThemeConfig,
  type ThemePanelConfig,
  type ToggleSpec,
  type TranscriptMessage,
  type TranscriptState,
} from './panels.js';
