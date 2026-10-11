import { AdminShell, ComplianceThemePanel, ConversationPanel, ModelPanel } from '@haeckmec/grounded-chat/admin-react';
import { ChatWidget, GroundedChatStyles } from '@haeckmec/grounded-chat/react';
import type { RecipeSnapshot } from './pack.js';

const LANGUAGES = ['en'] as const;

/** The chat: the package's widget, a card for a looked-up blend, the default stylesheet. */
export function KbChat({ fetch }: { fetch: typeof globalThis.fetch }) {
  return (
    <>
      <GroundedChatStyles />
      <ChatWidget
        languages={LANGUAGES}
        strings={{ en: { title: 'Blend assistant', starterReplies: ['Harbour Mist', 'What can replace mint?'] } }}
        fetch={fetch}
        customEvents={{ recipe: (data) => (data as { recipe: RecipeSnapshot }).recipe }}
        renderers={{
          recipe: (message) => {
            const recipe = message.data as RecipeSnapshot;
            return (
              <div data-testid="recipe-card" className="gc-card">
                <strong>{recipe.name}</strong>
                {recipe.untested && <em> untested riff</em>}
                <ul>
                  {recipe.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            );
          },
        }}
      />
    </>
  );
}

/** The admin: three of the package's panels behind the host's own login. */
export function KbAdmin({ fetch }: { fetch: typeof globalThis.fetch }) {
  return (
    <AdminShell
      title="Blend assistant admin"
      tabs={[
        {
          id: 'conversation',
          label: 'Conversation',
          render: () => (
            <ConversationPanel
              languages={LANGUAGES}
              defaults={{
                welcomeMessage: { en: 'Ask me about a blend.' },
                quickReplies: { en: ['Harbour Mist'] },
                fallbackText: { en: 'That is not in the knowledge base.' },
                humanHandoffText: { en: 'Write to the shop.' },
              }}
              fetch={fetch}
            />
          ),
        },
        {
          id: 'model',
          label: 'Model',
          render: () => (
            <ModelPanel
              providers={[{ value: 'dummy', label: 'Dummy' }]}
              models={[{ value: '', label: 'Model default' }]}
              defaults={{ provider: 'dummy', modelName: '', thinkingLevel: '', maxMessagesPerSession: 40, tokenBudgetPerSession: 20000 }}
              fetch={fetch}
            />
          ),
        },
        {
          id: 'theme',
          label: 'Theme',
          render: () => (
            <ComplianceThemePanel languages={LANGUAGES} defaults={{ retentionDays: 30, theme: { logoUrl: '', primaryColor: '', font: '' } }} fetch={fetch} />
          ),
        },
      ]}
    />
  );
}
