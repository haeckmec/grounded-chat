# API notes

Every export carries a doc comment; this page is the map. `test/api-review.test.ts` fails the build if an export lacks a doc comment or a runtime export appears in no test.

## Core: `@haeckmec/grounded-chat`

Pure: no fetch, env or fs, so it runs on a server, at the edge or in a browser.

| Area | Exports | Notes |
| --- | --- | --- |
| Turn engine | `runTurn`, `TurnPack`, `ToolOutcome`, `ToolContext`, `RunTurnOptions`, `RunTurnResult`, `TurnMetrics`, `DEFAULT_TURN_STRINGS` | One turn: tool loop, guard on every streamed piece, one 503 retry before any text, caps, retention, metrics. Persists the user message and the reply together, only on success |
| Figure guard | `stripUnauthorizedNumbers`, `StreamingNumberGuard`, `findLeaks`, `hasLeak`, `FigureClass`, `moneyFigures`, `measureFigures`, `findAmountSpans`, `findMeasureSpans`, `DEFAULT_REPLACEMENTS` | One figure definition per class, shared by the streaming guard, the whole-reply guard and the leak check; streamed output equals whole-reply output for every cut |
| Storage | `ChatStore`, `InMemoryChatStore`, `chatStoreContractCases` | Sessions, messages, snapshots (keyed ones replace), authorized figures |
| Intake | `IntakePlan`, `intakePromptLines`, `userWordsSchema`, `unstatedSlots`, `nextMissingSlot`, `applicableSlots` | A plan compiles into the prompt lines, the completion tool's user's-words schema, the grounding check and the scripted order |
| Judge | `JudgeSpec`, `defaultVerdicts`, `runJudge`, `judgeInstructions`, `judgeResponseSchema`, `judgeUserMessage`, `parseJudgeReply`, `scoreReply` | Pack-defined verdicts; an ungraded reply is never a pass |
| Model port | `LlmPort`, `streamTurn`, `LlmProviderError`, `llmPortContractCases` | The contract is framework-free: register its cases with your runner |
| Canaries | `createCanaries` | `PREFIX-WORD-NUMBER` codes, matched with any separator |
| Limits | `isMessageCapExceeded`, `isTokenBudgetExceeded`, `createSweepThrottle` | |

## Adapters

- `/adapters/gemini`: `GeminiLlmAdapter` (Interactions API, streaming, thought-signature replay). The only network code.
- `/adapters/dummy`: `DummyLlmAdapter(script)`, `dummyCallId`, `estimateTokens`. Streams in small chunks so figures split across deltas.

## `/http`

`createFixedWindowRateLimiter`, `isOriginAllowed`, `parseOriginAllowlist`, `clientKey`, `guardPublicRequest` on Web `Request`/`Response`; also the message-cap and token-budget checks.

## `/client`

`readServerSentEvents`, `parseEmbedParams` with `isValidOrigin` and `sanitizeHexColor`, `contrastTextColor`, `FONT_OPTIONS` with `findFontOption` and `googleFontsHref`.

## `/react`

`useGroundedChat`, `ChatWidget` (renderer map for custom messages, `classNames` slots, `theme`, strings per language), `Toast`, `GroundedChatStyles`/`GROUNDED_CHAT_CSS`, `DEFAULT_WIDGET_STRINGS`, `FRENCH_WIDGET_STRINGS`, `DEFAULT_WIDGET_CLASSES`, `Playground`, `PlaygroundStats`. Every component takes the host's `fetch`.

## `/admin`

`createConfigHandlers` (ETag and If-Match), `createTranscriptHandler`, `createPruneHandler`, `createStatsHandler`: each refuses with 401 unless the host's `authorize` returns true. `ConfigStore` with `InMemoryConfigStore` and `configStoreContractCases`; `findSecretShapedKeys`, `SECRET_KEY_PATTERN`; `coerceLocalizedText`, `coerceLocalizedList`.

## `/admin-react`

`AdminShell`, `ConversationPanel`, `ModelPanel`, `ComplianceThemePanel` (generic retention and theme; the pack brings compliance copy and toggles), `TranscriptView` with `loadTranscript`, and the primitives `useConfigPanel`, `InfoTooltip`, `LanguageToggle`, `LoadingPlaceholder`, `SaveRow`, styled through `AdminClassNamesProvider`.

## `/eval`

`gradeEvalSet`, `agreement`, `percentile`, `summariseLatency`, `timedPort`, `refuseInCi`. Library functions; the host's scripts read fixtures, hold the key and write results.
