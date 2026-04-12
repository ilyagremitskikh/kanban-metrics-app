---
created: "2026-04-12T00:00:00Z"
last_edited: "2026-04-12T00:00:00Z"
---
# Loop Log

### Wave 1 — 2026-04-12
- T-001..T-004: category grouping — DONE. Files: src/components/IssuesTab.tsx. Build P, TS P. Commit: ba249b3

### Wave 2 — 2026-04-12
- T-005, T-006: Score column + sort in `IssuesTab` — DONE.
- T-008..T-013: dynamic issue types utility + badges/charts/forms/settings integration — DONE.
- T-014..T-016: throughput grouping toggles + by-assignee aggregation/colors — DONE.
- T-020, T-024, T-027: settings audit (`n8nBaseUrl`, Jira URL propagation, grouped settings UI) — DONE.
- Verification: `npm run build` PASS.
- Verification: `npm run test` has 1 existing failure in `src/lib/__tests__/metrics.test.ts` (`Dev CT = first DOWNSTREAM → last "Готово"`, threshold mismatch 1.056 > 1.05).
