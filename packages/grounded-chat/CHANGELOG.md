# @haeckmec/grounded-chat

## 0.0.2

### Patch Changes

- cb6b57b: The figure guard, canaries and the model port arrive in the core: `stripUnauthorizedNumbers`, `StreamingNumberGuard`, `findLeaks` and `hasLeak` read figures through a `FigureClass` (`moneyFigures` is the default and behaves exactly as before), and take the replacement text from the pack (`DEFAULT_REPLACEMENTS` for English and French). `createCanaries` plants and finds reference codes. `LlmPort`, `streamTurn`, `LlmProviderError` and `llmPortContractCases`, the framework-free contract any adapter runs. `/adapters/gemini` ships `GeminiLlmAdapter`; `/adapters/dummy` ships a scripted `DummyLlmAdapter` a pack drives with its own script.

## 0.0.1

### Patch Changes

- 753135b: First release with the public subpaths in place and nothing exported yet: `.`, `/adapters/gemini`, `/adapters/dummy`, `/http`, `/client`, `/react`, `/admin`, `/admin-react`, `/eval`. Proves the exports map, the build and registry installs before any code lands.
