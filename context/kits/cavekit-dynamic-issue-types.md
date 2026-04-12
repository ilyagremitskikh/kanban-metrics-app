---
created: 2026-04-12T00:00:00Z
last_edited: 2026-04-12T00:00:00Z
---

# Cavekit: Dynamic Issue Types

## Scope

Replace all hardcoded issue type arrays and color maps with data-driven derivation. A shared utility derives the list of known types from fetched data and assigns stable colors from a palette. All UI elements that reference issue types (badges, charts, form dropdowns, settings checkboxes, category grouping) consume this utility.

## Requirements

### R1: Single Source of Truth for Issue Types

**Description:** Issue types are derived from data received from the API, not from hardcoded arrays. A shared utility provides the list of known types and assigns stable colors from a palette. The same utility is consumed by all downstream components.

**Acceptance Criteria:**
- [ ] No hardcoded issue type arrays exist in settings, issue creation forms, or issue form field components
- [ ] A shared utility exists that accepts a collection of issues and returns the set of unique issue types
- [ ] The shared utility assigns a deterministic color to each type name such that the same type always maps to the same color
- [ ] Adding a new issue type in the upstream system causes it to appear in all UI elements without code changes

**Dependencies:** None

### R2: Dynamic Badge Colors

**Description:** Type badges assign colors dynamically from the shared palette based on the type name string. No hardcoded conditional logic per type.

**Acceptance Criteria:**
- [ ] Type badges render correctly for any arbitrary type string
- [ ] Type badge colors are sourced from the shared utility (R1), not from per-type conditional logic
- [ ] Each unique type name produces a consistent color across all renders

**Dependencies:** R1

### R3: Dynamic Chart Colors

**Description:** The throughput chart uses the shared dynamic color utility for type-based segment colors instead of a hardcoded color map.

**Acceptance Criteria:**
- [ ] The throughput chart renders correct colors for all issue types including types not present at build time
- [ ] Chart colors are sourced from the shared utility (R1)

**Dependencies:** R1

### R4: Dynamic Form Dropdowns

**Description:** Issue type dropdowns in issue creation and editing forms are populated from the set of types present in fetched issue data.

**Acceptance Criteria:**
- [ ] Issue type dropdowns display all types present in fetched issues data
- [ ] New types added in the upstream system appear in dropdowns without code changes
- [ ] Dropdowns contain no hardcoded type options

**Dependencies:** R1

### R5: Dynamic Settings Checkboxes

**Description:** Issue type filter checkboxes in settings are populated from the set of types present in fetched data.

**Acceptance Criteria:**
- [ ] Settings displays checkboxes for all issue types present in fetched data
- [ ] New types appear as checkboxes automatically without code changes
- [ ] No hardcoded type list exists in the settings component

**Dependencies:** R1

### R6: Dynamic Category Grouping

**Description:** The category grouping map in the issues tab derives type-to-category assignment from fetched data. Types not matched by any predefined category (User Story, Задача, Ошибки, Техдолг) fall into the existing "Прочее" catchall group as defined in cavekit-issue-category-grouping R1. No code change is required for a new type to appear — it is automatically routed to "Прочее" and displayed there.

**Acceptance Criteria:**
- [ ] Issues are grouped by their actual type as returned from the API
- [ ] A type not matching any predefined category mapping appears in the "Прочее" group (per cavekit-issue-category-grouping R1), not as a standalone new group
- [ ] No hardcoded type list prevents a new type from appearing in the issues view

**Dependencies:** R1; cavekit-issue-category-grouping R1

## Out of Scope

- Type-based routing in the RICE scoring section (the hardcoded split between Bug/TechDebt scoring models is intentional and not affected)
- User-customizable color assignments
- Persisting a custom palette across sessions

## Cross-References

- See also: [cavekit-throughput-grouping](cavekit-throughput-grouping.md) -- R3 of throughput-grouping depends on this kit's R1 for type colors
- See also: [cavekit-issue-category-grouping](cavekit-issue-category-grouping.md) -- R6 depends on and extends the category grouping behavior defined in that kit
- See also: [cavekit-settings-audit](cavekit-settings-audit.md) -- R5 (dynamic settings checkboxes) is placed in settings Group 3 as defined in settings-audit R3
