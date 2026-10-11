# Logbook

One entry per batch gate, appended by `/logbook`. The monthly `/compass` reads this file across all projects.

Format per entry:

```
## <date> · <milestone or gate>
- Time: <evenings or sessions spent>
- Slowed us down: <one line>
- Rule that helped: <rule, file>
- Rule that hurt or was missing: <rule, file>
- Proposed change: <to the project or to global rules>
```

## 2026-10-11 · K0 to K7
- Time: one unattended cloud session.
- Slowed us down: the container itself: no registry token, npm 10.9 lockfile churn and export failure, a Playwright browser build mismatch for the api suite, cold-server screenshot noise.
- Rule that helped: golden transcripts recorded before any move (`methodology.md`, golden cases); they made every batch a byte comparison instead of a judgement.
- Rule that hurt or was missing: none hurt. Missing: a rule that the example declares its own dependencies and runs outside the workspace from the first batch, not only before a publish.
- Proposed change: run `check:packed` in CI from K0 on in any future package repo.
