# Gaps: open

What this repo still owes. IDs (G-1, G-2) never change. Before filing a bug, search this file for the symptom. Closed items move to the bottom section with the commit that closed them.

| Status | Meaning |
| --- | --- |
| Open | Work this repo owes, no outside dependency |
| Waiting | Needs an answer or credential from someone else |
| Deferred | Decided not now; the reopening trigger is named |

| ID | Area | Gap | Status | Next step |
| --- | --- | --- | --- | --- |
| G-1 | Registry | Vercel installing a GitHub Packages dependency is unproven (I think about **30%** it needs an `.npmrc` or env tweak on the first try). Fallback: a vendored `npm pack` tarball as a `file:` dependency, about 1 hour | Open | Closed by K0's northstar-react half: install `0.0.1` in `apps/chatbot` and build a Vercel preview |

## Closed

| ID | Closed in | Note |
| --- | --- | --- |
