# UI standard: classes and CSS variables

The package's React components carry no styling framework. A host styles them one of two ways, or mixes both.

## 1. The default stylesheet, themed by CSS variables

Render `<GroundedChatStyles />` once (or put `GROUNDED_CHAT_CSS` in your own stylesheet). It styles the default `gc-` classes and reads only these variables, set on `.gc-root` or any ancestor:

| Variable | Default | Used for |
| --- | --- | --- |
| `--gc-bg` | `#ffffff` | widget background |
| `--gc-fg` | `#18181b` | text |
| `--gc-muted` | `#71717a` | secondary text, inactive buttons |
| `--gc-border` | `#e4e4e7` | dividers, pill and input borders |
| `--gc-surface` | `#f4f4f5` | assistant bubbles |
| `--gc-primary` | `#18181b` | user bubbles, active language, send button |
| `--gc-primary-fg` | `#ffffff` | text on the primary colour |
| `--gc-error` | `#dc2626` | error line |
| `--gc-radius` | `1rem` | bubbles and input |
| `--gc-font` | `inherit` | font family |
| `--gc-max-width` | `42rem` | widget width |

`contrastTextColor(primary)` from `/client` gives a readable `--gc-primary-fg` for any primary colour.

## 2. Your own classes, slot by slot

`ChatWidget` takes `classNames`, a partial `WidgetClassNames`. A slot you pass replaces that element's class; a slot you leave out keeps its `gc-` default. Paired slots are joined: `languageButton` with `languageButtonActive` or `languageButtonInactive`, `bubble` with `bubbleUser` or `bubbleAssistant`. `Playground` and `PlaygroundStats` take their own `classNames` the same way. This is how a Tailwind app keeps its exact look: `apps/chatbot` in Quoteproof passes its utility classes and renders pixel-identical to its previous hand-written widget.

## Theme values

`theme` (`primaryColor`, `font`, `logoUrl`) applies as inline styles, so it wins over either way above: the primary colour on the title, user bubbles, active language and send button, the font on the root. A font from `FONT_OPTIONS` loads its stylesheet; any other family name is left to the host's own font stack.

## Rules for the package's own CSS

- Class names start with `gc-`; variable names with `--gc-`.
- Colours and radii come from variables, never literals, except the variables' own defaults.
- No selector reaches outside `.gc-root`, except the toast, which is fixed to the viewport.
