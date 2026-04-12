---
created: 2026-04-12T00:00:00Z
last_edited: 2026-04-12T00:00:00Z
---

# Cavekit: Throughput Grouping

## Scope

Add a grouping toggle to the throughput chart allowing users to switch between stacking by issue type and stacking by assignee. Default mode is by issue type.

## Requirements

### R1: Grouping Toggle UI

**Description:** A pill-style toggle above the throughput chart lets the user switch between two grouping modes: "By issue type" (label: "По типу задач") and "By assignee" (label: "По исполнителю"). The active mode is visually highlighted.

**Acceptance Criteria:**
- [ ] Two toggle buttons are visible above the throughput chart
- [ ] Toggle button labels are "По типу задач" and "По исполнителю"
- [ ] The active mode button is visually distinct from the inactive one
- [ ] Default active mode on initial render is "По типу задач"
- [ ] Switching modes updates the chart immediately without a page reload

**Dependencies:** None

### R2: By-Assignee Breakdown

**Description:** When the "По исполнителю" mode is active, the stacked bar chart shows one segment per unique assignee. Issues with no assignee are grouped under "Не назначен".

**Acceptance Criteria:**
- [ ] In assignee mode, the chart displays one stacked segment per unique assignee name
- [ ] Each unique assignee is assigned a distinct color
- [ ] The chart legend displays assignee names
- [ ] Issues with a null or empty assignee field are grouped under the label "Не назначен"
- [ ] The assignee name is read from the `assignee` field in the throughput API response

**Dependencies:** R1

### R3: By-Type Breakdown (Existing Behavior)

**Description:** When the "По типу задач" mode is active, the chart stacks by issue type, preserving existing behavior. Colors are assigned using the shared dynamic color utility.

**Acceptance Criteria:**
- [ ] In by-type mode, the chart stacks by issue type identically to the current behavior
- [ ] Type colors are sourced from the shared dynamic color utility described in cavekit-dynamic-issue-types R1

**Dependencies:** R1; cavekit-dynamic-issue-types R1

## Out of Scope

- Additional grouping modes beyond type and assignee
- Persisting the selected grouping mode across sessions
- Filtering by specific assignees or types within the chart

## Cross-References

- See also: [cavekit-dynamic-issue-types](cavekit-dynamic-issue-types.md) -- R3 depends on the dynamic color utility (R1) for type colors
