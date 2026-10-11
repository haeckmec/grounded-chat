import { createContext, useContext, type ReactNode } from 'react';

/** Every element of the admin components a host can style, by slot. */
export interface AdminClassNames {
  shell: string;
  shellTitle: string;
  tabs: string;
  /** Every tab; joined with the active or inactive slot. */
  tab: string;
  tabActive: string;
  tabInactive: string;
  panel: string;
  panelHeader: string;
  hint: string;
  headerActions: string;
  resetLink: string;
  field: string;
  fieldLabel: string;
  textarea: string;
  input: string;
  select: string;
  selectWide: string;
  inputDisabled: string;
  /** A group of fields edited per language, set apart from the rest. */
  localizedBox: string;
  localizedNote: string;
  localizedTextarea: string;
  inlineRow: string;
  inlineField: string;
  secondaryButton: string;
  result: string;
  checkboxField: string;
  sectionTitle: string;
  saveButton: string;
  saved: string;
  saveError: string;
  loading: string;
  tooltip: string;
  languageGroup: string;
  languageButton: string;
  languageButtonActive: string;
  languageButtonInactive: string;
  transcriptNote: string;
  transcriptError: string;
  transcript: string;
  transcriptRowUser: string;
  transcriptRowAssistant: string;
  transcriptBubble: string;
  transcriptBubbleUser: string;
  transcriptBubbleAssistant: string;
}

/** `gc-admin-` classes for a host that brings its own stylesheet. */
export const DEFAULT_ADMIN_CLASSES: AdminClassNames = Object.fromEntries(
  (
    [
      'shell', 'shellTitle', 'tabs', 'tab', 'tabActive', 'tabInactive', 'panel', 'panelHeader', 'hint', 'headerActions', 'resetLink',
      'field', 'fieldLabel', 'textarea', 'input', 'select', 'selectWide', 'inputDisabled', 'localizedBox', 'localizedNote',
      'localizedTextarea', 'inlineRow', 'inlineField', 'secondaryButton', 'result', 'checkboxField', 'sectionTitle', 'saveButton',
      'saved', 'saveError', 'loading', 'tooltip', 'languageGroup', 'languageButton', 'languageButtonActive', 'languageButtonInactive',
      'transcriptNote', 'transcriptError', 'transcript', 'transcriptRowUser', 'transcriptRowAssistant', 'transcriptBubble',
      'transcriptBubbleUser', 'transcriptBubbleAssistant',
    ] as const
  ).map((slot) => [slot, `gc-admin-${slot.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`]),
) as unknown as AdminClassNames;

const AdminClassContext = createContext<AdminClassNames>(DEFAULT_ADMIN_CLASSES);

/** Sets the classes for every admin component below it; a slot left out keeps its default. */
export function AdminClassNamesProvider({ value, children }: { value: Partial<AdminClassNames>; children: ReactNode }) {
  return <AdminClassContext.Provider value={{ ...DEFAULT_ADMIN_CLASSES, ...value }}>{children}</AdminClassContext.Provider>;
}

/** The classes in effect. */
export function useAdminClasses(): AdminClassNames {
  return useContext(AdminClassContext);
}

export function join(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
