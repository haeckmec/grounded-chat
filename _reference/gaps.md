# Gaps: open

What this repo still owes. IDs (G-1, G-2) never change. Before filing a bug, search this file for the symptom. Closed items move to the bottom section with the commit that closed them.

| Status | Meaning |
| --- | --- |
| Open | Work this repo owes, no outside dependency |
| Waiting | Needs an answer or credential from someone else |
| Deferred | Decided not now; the reopening trigger is named |

| ID | Area | Gap | Status | Next step |
| --- | --- | --- | --- | --- |
None open.

## Closed

| ID | Closed in | Note |
| --- | --- | --- |
| G-1 | northstar-react 20c869a (2026-10-11) | `apps/chatbot` pins `@haeckmec/grounded-chat` at exactly `0.1.0` from GitHub Packages. The registry tarball has the same sha512 as the vendored one. The Vercel preview built from the registry, READY, once `NODE_AUTH_TOKEN` was added to the Vercel project env. The standalone export writes its own `.npmrc`. Screens: Linux baseline cannot match byte for byte on Windows, so master and the branch were compared on one Windows production build: 10 of 11 byte-identical, the 11th differs only in an upload timestamp |
| G-2 | northstar-react branch `chore/g1-registry-pin` (2026-10-11) | Root gate green locally: 36 of 36 tasks, comment check clean, api 119 files and 880 tests with none skipped (`REQUIRE_DB=1`), so the PDF tests pass. The first parallel run failed on timeouts only (about 1.7 GB RAM free); the green run used `--concurrency=1`. On this laptop the root gate needs it |
| G-3 | northstar-react f9945c6 (2026-10-11) | Live judge on `gemini-3.5-flash-lite`: 120 of 120 against the labels, and against the second grader. The default `gemini-3.5-flash` allows about 20 requests a day on the free tier, so it was not used. The recorded results file had 7 ungraded conversations from an earlier cap; all 40 are now graded |
| G-4 | northstar-react f9945c6 (2026-10-11) | `admin.spec.ts` waits for the activate response at both the activate and the rollback click. 5 of 5 on cold dev servers. New finding: the spec only passes on a fresh `chatbot.db`; a reused database holds two retired versions and "Roll back to this" matches two buttons |
