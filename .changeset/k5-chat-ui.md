---
"@haeckmec/grounded-chat": patch
---

Chat UI. `/client`: `readServerSentEvents`, `parseEmbedParams` with `isValidOrigin` and `sanitizeHexColor`, `contrastTextColor`, `FONT_OPTIONS` with `findFontOption` and `googleFontsHref`. `/react`: `useGroundedChat` (streaming state, custom messages from named events, reset and abort), `ChatWidget` (header, language switch, transcript with a renderer map, starter and suggested replies, composer, toast) styled only through `classNames` slots and CSS variables, `GroundedChatStyles` and `GROUNDED_CHAT_CSS`, `DEFAULT_WIDGET_STRINGS` and `FRENCH_WIDGET_STRINGS`, `Playground` and `PlaygroundStats`. The UI takes the host's `fetch`, so the package makes no network call of its own.
