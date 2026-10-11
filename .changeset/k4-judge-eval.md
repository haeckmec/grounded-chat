---
"@haeckmec/grounded-chat": patch
---

Judge and eval. `runJudge` grades a reply with pack-defined verdicts (`JudgeSpec`: preamble, `VerdictDefinition`s, closing, headings); `judgeInstructions`, `judgeResponseSchema`, `judgeUserMessage` and `parseJudgeReply` expose each step, and `defaultVerdicts(scope)` is a reusable set (unsupported claim, off-topic, leaked instructions). `scoreReply` scores a reply from the leak check, the canaries and the verdicts. `/eval` ships `gradeEvalSet`, `agreement`, `percentile`, `summariseLatency`, `timedPort` and `refuseInCi`. Every subpath now also has a `default` export condition, so CommonJS callers (tsx scripts) can require the ESM build; the Node floor is 20.19.
