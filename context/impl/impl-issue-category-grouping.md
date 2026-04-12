---
created: "2026-04-12T00:00:00Z"
last_edited: "2026-04-12T00:00:00Z"
---
# Implementation Tracking: issue-category-grouping

Build site: context/plans/build-site.md

| Task  | Status | Notes |
|-------|--------|-------|
| T-001 | DONE   | groupByCategory() + CATEGORY_MAP + CATEGORY_ORDER added to IssuesTab.tsx |
| T-002 | DONE   | Grouped sections with per-category header rows; empty categories hidden; useMemo |
| T-003 | DONE   | collapsedCategories: Set<string> state; ChevronUp/Down indicators; resets on remount |
| T-004 | DONE   | All columns, footer total, slide-over, loading/error/empty states preserved; build passes |
