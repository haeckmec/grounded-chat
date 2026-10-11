---
"@haeckmec/grounded-chat": patch
---

`IntakePlan`: ordered slots (`id`, `label`, `askHint`, `required`, `when`, `quickReplies`) and a completion tool. `intakePromptLines` compiles the prompt's question order and own-words rule, `userWordsSchema` the completion tool's user's-words argument, `unstatedSlots` the grounding check (every value the model passes must be in the user's own words), and `nextMissingSlot` and `applicableSlots` the order a scripted adapter asks in.
