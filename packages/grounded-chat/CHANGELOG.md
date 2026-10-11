# @haeckmec/grounded-chat

## 0.0.4

### Patch Changes

- 69c5b63: `IntakePlan`: ordered slots (`id`, `label`, `askHint`, `required`, `when`, `quickReplies`) and a completion tool. `intakePromptLines` compiles the prompt's question order and own-words rule, `userWordsSchema` the completion tool's user's-words argument, `unstatedSlots` the grounding check (every value the model passes must be in the user's own words), and `nextMissingSlot` and `applicableSlots` the order a scripted adapter asks in.

## 0.0.3

### Patch Changes

- 3f1ab75: The turn engine and the store port. `runTurn` runs one chat turn for a `TurnPack` (tools, system prompt, tool executor, figure rule, no-answer reply): the tool loop, the figure guard on every streamed piece, one 503 retry before any text, message cap, token budget, retention sweep and metrics. Tools return `ToolOutcome` (`payload`, `authorizedFigures`, `snapshot`). `ChatStore` is the storage port with `InMemoryChatStore` and the framework-free `chatStoreContractCases`. `createSweepThrottle`, `isMessageCapExceeded` and `isTokenBudgetExceeded` are exported. `/http` ships `createFixedWindowRateLimiter`, `isOriginAllowed`, `parseOriginAllowlist`, `clientKey` and `guardPublicRequest` on Web `Request` and `Response`.

## 0.0.2

### Patch Changes

- cb6b57b: The figure guard, canaries and the model port arrive in the core: `stripUnauthorizedNumbers`, `StreamingNumberGuard`, `findLeaks` and `hasLeak` read figures through a `FigureClass` (`moneyFigures` is the default and behaves exactly as before), and take the replacement text from the pack (`DEFAULT_REPLACEMENTS` for English and French). `createCanaries` plants and finds reference codes. `LlmPort`, `streamTurn`, `LlmProviderError` and `llmPortContractCases`, the framework-free contract any adapter runs. `/adapters/gemini` ships `GeminiLlmAdapter`; `/adapters/dummy` ships a scripted `DummyLlmAdapter` a pack drives with its own script.

## 0.0.1

### Patch Changes

- 753135b: First release with the public subpaths in place and nothing exported yet: `.`, `/adapters/gemini`, `/adapters/dummy`, `/http`, `/client`, `/react`, `/admin`, `/admin-react`, `/eval`. Proves the exports map, the build and registry installs before any code lands.
