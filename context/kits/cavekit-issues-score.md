---
created: 2026-04-12T00:00:00Z
last_edited: 2026-04-12T00:00:00Z
---

# Cavekit: Issues Score

## Scope

Display a Score column in the Jira issues table showing the composite score for each issue with a color-coded badge indicating the score type (RICE, Bug, or TechDebt). The column is sortable.

## Requirements

### R1: Score Column Display

**Description:** The issues table includes a Score column that shows the numeric score value and a colored badge indicating the score type for each issue.

**Acceptance Criteria:**
- [ ] A "Score" column is visible in the issues table
- [ ] The score value is the first non-null value among: rice_score, bug_score, td_roi (in that precedence order)
- [ ] The score type is determined by which source field provided the value: "rice" for rice_score, "bug" for bug_score, "techdebt" for td_roi
- [ ] Score values are displayed as a numeric value alongside a colored badge
- [ ] Badge color for RICE type is blue
- [ ] Badge color for Bug type is red
- [ ] Badge color for TechDebt type is yellow
- [ ] Issues with null score (all three source fields are null) show an empty cell with no badge

**Dependencies:** None

### R2: Score Column Sorting

**Description:** The Score column supports ascending and descending sort. Null scores always sort to the end regardless of direction.

**Acceptance Criteria:**
- [ ] Clicking the Score column header toggles the sort direction
- [ ] When Score column is first clicked, the default sort direction is descending (highest score first)
- [ ] Issues with null scores appear last when sorted ascending
- [ ] Issues with null scores appear last when sorted descending
- [ ] Sort direction toggles between ascending and descending on subsequent clicks

**Dependencies:** R1

## Out of Scope

- Editing or recalculating score values from the issues table
- Filtering issues by score range or score type
- Score column in any view other than the issues table

## Cross-References

- Score source fields (rice_score, bug_score, td_roi) originate from the RICE scoring system; the issues table only reads these values
