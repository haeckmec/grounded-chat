# Decisions

Calls already made, newest at the bottom. "Overridable" marks a default picked during `/summit`; Jan reviews those at gate close and either keeps or reverses them.

| ID | Date | Decision | Why | Status |
| --- | --- | --- | --- | --- |
| D-1 | 2026-10-10 | Own private repo `haeckmec/grounded-chat`, consumed as a package by Quoteproof and Jan's Back Bar. Neither product owns it | Two consumers and a possible product; neither app should carry the other's history | Kept |
| D-2 | 2026-10-10 | Package `@haeckmec/grounded-chat` (working name), license `UNLICENSED`, published to GitHub Packages, consumers pin an exact version | Private, no public registry yet; exact pins make every upgrade a deliberate consumer commit | Kept |
| D-3 | 2026-10-10 | Versions stay 0.x until back-bar ships on it, then 1.0. Changesets write the changelog | The API settles only once a second consumer runs on it | Kept |
| D-4 | 2026-10-10 | Extracted now, before Quoteproof's F0, as batches K0 to K7 in one block. Nothing else starts in northstar-react until `0.1.0` is published | Back-bar M3 consumes it and F0/F2 build on it | Kept |
| D-5 | 2026-10-10 | Quoteproof's intake plan is later derived from its pricing model inputs; the SDK only defines the `IntakePlan` type and what it compiles into | The pricing model owns which inputs exist | Kept |
| D-6 | 2026-10-10 | The SDK ships chat UI (hook, primitives, ready-made widget) and generic admin (handlers and panels). Quote card, rate tables and leads stay in the quote pack | Every pack needs chat state and generic admin; quote parts are domain | Kept |
| D-7 | 2026-10-10 | UI is styled only through CSS variables and `className` slots. No Tailwind inside the package | A package shipping Tailwind classes breaks hosts without Tailwind and fights their design system | Kept |
| D-8 | 2026-10-10 | The SDK never owns accounts or auth. Every admin handler takes the host's `authorize` callback and refuses without it (deny by default) | A library admin handler without auth is a hole the day a host forgets to wire it | Kept |
| D-9 | 2026-10-10 | First real LLM adapter is Gemini (`gemini-3.5-flash-lite` default), plus a dummy adapter. A Claude adapter is out until asked | Matches the live chatbot | Kept |
| D-10 | 2026-10-10 | Project starts in full mode | Two triggers hold: a wrong figure is the failure the SDK prevents (money logic), and two apps consume it from the start. The resume block also suits 8 batches that each stop at a gate | Kept |
| D-11 | 2026-10-10 | "policy" is not on the domain-word list. Banned: insurance, premium, quote, rate table, cocktail, bar, drink | The spec's own API uses it (`runTurn({ policy })`, the intake policy layer). The other insurance words still catch a leak | Kept |
| D-12 | 2026-10-10 | Basecamp's web-app scaffold is left out: no `apps/web`, Next.js, shadcn, Playwright, `ui-standards.md` or `verify:screens`. The repo follows the handover layout instead | This is a library. Screens are verified in the consumers; the package's own CSS-variable standard is written with the UI in K5 | Kept |
| D-13 | 2026-10-10 | Lint rules live in a private workspace `tooling/eslint-config` with their own tests; matching is per word after splitting camelCase, snake_case and kebab-case, plurals included | "Lint-enforced" needs proof the rules fire. Word matching lets `toolbar` pass but flags `progressBar`, which packs then name differently | Kept |
| D-14 | 2026-10-10 | Node built-ins (`node:*`, `fs`, `path`, `http` and similar) are banned outside `src/adapters/`, not only `fs` | The core must run on edge and in browsers; Web APIs (`crypto.getRandomValues`, `TextEncoder`) cover what it needs | Kept |
| D-15 | 2026-10-10 | No prettier | Basecamp doesn't set it up, and the handover asked for it only if basecamp does | Kept |
| D-16 | 2026-10-10 | CI runs the gate on Node 20 and 24 | Node 20 is the stated floor; 24 is current LTS and what release.yml publishes with | Kept |
