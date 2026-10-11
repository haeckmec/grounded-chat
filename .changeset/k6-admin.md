---
"@haeckmec/grounded-chat": patch
---

Admin. `/admin`: `createConfigHandlers` (GET and PUT with ETag and If-Match, 409 on a concurrent change), `createTranscriptHandler`, `createPruneHandler` and `createStatsHandler` on Web `Request` and `Response`, each refusing with 401 unless the host's `authorize` returns true; the `ConfigStore` port with `InMemoryConfigStore` and `configStoreContractCases`; `findSecretShapedKeys` and `SECRET_KEY_PATTERN`; `coerceLocalizedText` and `coerceLocalizedList`. `/admin-react`: `AdminShell`, `ConversationPanel`, `ModelPanel`, `ComplianceThemePanel` (retention and theme generic, compliance copy and toggles from the pack), `TranscriptView` with `loadTranscript`, `useConfigPanel`, `InfoTooltip`, `LanguageToggle`, `LoadingPlaceholder`, `SaveRow`, all styled through `AdminClassNamesProvider`.
