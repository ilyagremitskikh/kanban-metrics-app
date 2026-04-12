---
created: "2026-04-12T00:00:00Z"
last_edited: "2026-04-12T00:00:00Z"
---
# Implementation Tracking: Make Wave 2

Build site: context/plans/build-site.md

| Task(s) | Status | Notes |
|---|---|---|
| T-005, T-006 | DONE | Added score column and score sorting with null-last behavior in `src/components/IssuesTab.tsx`; added score fields to `JiraIssueShort` in `src/types.ts`. |
| T-008 | DONE | Added shared utility `src/lib/issueTypes.ts` (`getUniqueTypes`, `getTypeColor`, `getTypeBadgeClasses`). |
| T-009 | DONE | Refactored `TypeBadge` in `src/components/Badges.tsx` to shared dynamic badge classes for any type. |
| T-010 | DONE | Removed hardcoded throughput type map; `src/components/Charts.tsx` now uses `getTypeColor`. |
| T-011 | DONE | `IssueTypeSelect` now receives `availableTypes`; create/edit forms accept dynamic type options; `IssuesTab` computes types from fetched issues. |
| T-012 | DONE | Settings type checkboxes are dynamic (`availableTypes` fallback to selected types), hardcoded type list removed. |
| T-013 | DONE | Category fallback for unknown types preserved (`Прочее`) and verified in `groupByCategory` flow. |
| T-014 | DONE | Added throughput grouping toggle pills ("По типу задач" / "По исполнителю") in `ThroughputChart`. |
| T-015 | DONE | Added assignee grouping support (`ThroughputIssueRaw.assignee`, `ThroughputWeek.byAssignee`, metrics aggregation, chart rendering). |
| T-016 | DONE | By-type mode uses shared dynamic color utility in throughput chart. |
| T-020 | DONE | Added `n8nBaseUrl` to settings and API layer (`jiraApi`, `riceApi`) with dev-proxy-safe URL resolution. |
| T-024 | DONE | Removed hardcoded Jira base URL constants from `IssuesTable`, `AgingWIP`, `RiceSection`; URL comes from app settings props. |
| T-027 | DONE | Grouped settings page into "Вебхуки", "URL-адреса", "Фильтрация" sections with visual separators. |

## Verification
- `npm run build`: PASS
- `npm run test`: FAIL (existing threshold failure in `src/lib/__tests__/metrics.test.ts`, `Dev CT = first DOWNSTREAM → last "Готово"` expects `< 1.05`, actual `1.056354...`)
