# Gaps: open

What this repo still owes. IDs (G-1, G-2) never change. Before filing a bug, search this file for the symptom. Closed items move to the bottom section with the commit that closed them.

| Status | Meaning |
| --- | --- |
| Open | Work this repo owes, no outside dependency |
| Waiting | Needs an answer or credential from someone else |
| Deferred | Decided not now; the reopening trigger is named |

| ID | Area | Gap | Status | Next step |
| --- | --- | --- | --- | --- |
| G-1 | Registry | Vercel installing a GitHub Packages dependency is unproven (I think about **30%** it needs an `.npmrc` or env tweak on the first try). The fallback is in use (D-17): the vendored tarball builds on Vercel (preview of the K0 commit READY) | Waiting | A session with a `read:packages` token (`NODE_AUTH_TOKEN` in the environment): swap the `file:` dependency for the exact registry pin of the published `0.1.0`, `npm install`, push, and check the Vercel preview |
| G-2 | Gate | The northstar-react root gate cannot be fully green in the cloud container: the api's PDF tests need Playwright's pinned headless shell (1228), the container has 1194 and may not download browsers. Every other task is green; K touches no api code | Waiting | Run the root gate locally once before merging the K branch |
| G-3 | Judge | The live judge re-run on the labelled set (120 of 120) needs the dev Gemini key, which the cloud session lacks (D-19) | Waiting | `npx tsx scripts/judge-eval.ts` in `apps/chatbot` with `GEMINI_API_KEY` set; a mismatch is investigated, never relabelled |
| G-4 | Consumer e2e | On a cold dev server, the chatbot's admin rate-table spec once saw the old price after activating the edited table, then knocked on to two later specs; six full runs since were green. The spec waits for text that is already on the page instead of the activation response (I think it is a race in the spec, not the product) | Open | In northstar-react, make `e2e/admin.spec.ts` wait for the activate request's response before navigating |

## Closed

| ID | Closed in | Note |
| --- | --- | --- |
