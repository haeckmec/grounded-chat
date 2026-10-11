---
"@haeckmec/grounded-chat": patch
---

The turn engine and the store port. `runTurn` runs one chat turn for a `TurnPack` (tools, system prompt, tool executor, figure rule, no-answer reply): the tool loop, the figure guard on every streamed piece, one 503 retry before any text, message cap, token budget, retention sweep and metrics. Tools return `ToolOutcome` (`payload`, `authorizedFigures`, `snapshot`). `ChatStore` is the storage port with `InMemoryChatStore` and the framework-free `chatStoreContractCases`. `createSweepThrottle`, `isMessageCapExceeded` and `isTokenBudgetExceeded` are exported. `/http` ships `createFixedWindowRateLimiter`, `isOriginAllowed`, `parseOriginAllowlist`, `clientKey` and `guardPublicRequest` on Web `Request` and `Response`.
