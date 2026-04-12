---
created: 2026-04-12T00:00:00Z
last_edited: 2026-04-12T00:00:00Z
---

# Cavekit Overview

## Kits

| Kit | Description |
|-----|-------------|
| [cavekit-issue-category-grouping](cavekit-issue-category-grouping.md) | Group issues into collapsible sections by issue type with ordered category buckets |
| [cavekit-issues-score](cavekit-issues-score.md) | Score column in the issues table with colored badges and sorting |
| [cavekit-throughput-grouping](cavekit-throughput-grouping.md) | Toggle throughput chart grouping between issue type and assignee |
| [cavekit-dynamic-issue-types](cavekit-dynamic-issue-types.md) | Replace hardcoded issue type arrays with data-driven derivation |
| [cavekit-settings-audit](cavekit-settings-audit.md) | Add n8n Base URL setting, fix Jira URL hardcoding, group settings fields |

## Dependency Graph

```
cavekit-issue-category-grouping (standalone)
  R1: Category Buckets
  R2: Section Headers          --> R1
  R3: Collapse and Expand      --> R2
  R4: Preserved Functionality  --> R1

cavekit-issues-score (standalone)
  R1: Score Column Display
  R2: Score Column Sorting     --> R1

cavekit-dynamic-issue-types
  R1: Single Source of Truth
  R2: Dynamic Badge Colors     --> R1
  R3: Dynamic Chart Colors     --> R1
  R4: Dynamic Form Dropdowns   --> R1
  R5: Dynamic Settings Checkboxes --> R1
  R6: Dynamic Category Grouping   --> R1, cavekit-issue-category-grouping R1

cavekit-throughput-grouping
  R1: Grouping Toggle UI
  R2: By-Assignee Breakdown    --> R1
  R3: By-Type Breakdown        --> R1, cavekit-dynamic-issue-types R1

cavekit-settings-audit (standalone)
  R1: n8n Base URL Setting
  R2: Fix Jira Base URL Propagation
  R3: Settings Page Grouping   --> R1
```

No circular dependencies.

## Coverage Summary

| Metric | Count |
|--------|-------|
| Kits | 5 |
| Requirements | 18 |
| Acceptance Criteria | 83 |
