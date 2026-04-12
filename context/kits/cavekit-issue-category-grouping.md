---
created: 2026-04-12T00:00:00Z
last_edited: 2026-04-12T00:00:00Z
---

# Cavekit: Issue Category Grouping

## Scope

Group issues displayed in the issues list into collapsible sections based on issue type. Each issue belongs to exactly one category determined by its type field. The grouping is purely presentational and does not alter the underlying data or any external interfaces.

## Requirements

### R1: Category Buckets

**Description:** Every issue is assigned to exactly one category based on its type. Categories are evaluated in the following precedence order; the first match wins.

| Category       | Matching issue types                         |
|----------------|----------------------------------------------|
| User Story     | `User Story`                                 |
| Задача         | `Задача`, `Sub-task`, `Подзадача`            |
| Ошибки         | `Ошибка`, `Bug`                              |
| Техдолг        | `Техдолг`, `Tech Debt`                       |
| Прочее         | Any type not matched by the above categories |

**Acceptance Criteria:**
- [ ] An issue with type `User Story` appears in the "User Story" category
- [ ] An issue with type `Задача` appears in the "Задача" category
- [ ] An issue with type `Sub-task` appears in the "Задача" category
- [ ] An issue with type `Подзадача` appears in the "Задача" category
- [ ] An issue with type `Ошибка` appears in the "Ошибки" category
- [ ] An issue with type `Bug` appears in the "Ошибки" category
- [ ] An issue with type `Техдолг` appears in the "Техдолг" category
- [ ] An issue with type `Tech Debt` appears in the "Техдолг" category
- [ ] An issue with any other type (e.g. `Epic`) appears in the "Прочее" category
- [ ] No issue appears in more than one category
- [ ] Categories render in the fixed display order: User Story, Задача, Ошибки, Техдолг, Прочее

**Dependencies:** None

### R2: Section Headers

**Description:** Each non-empty category displays a header row above its issues. The header shows the category name and the count of issues in that category. Categories with zero issues are omitted entirely.

**Acceptance Criteria:**
- [ ] A category containing at least one issue renders a visible header row
- [ ] The header row displays the category name as text
- [ ] The header row displays the issue count for that category
- [ ] A category containing zero issues does not render a header row or any placeholder

**Dependencies:** R1

### R3: Collapse and Expand

**Description:** Each section header toggles the visibility of its category's issue rows when activated. All sections default to the expanded (visible) state. Collapse state is ephemeral and resets when the view is re-mounted.

**Acceptance Criteria:**
- [ ] On initial render, all category sections display their issue rows (expanded state)
- [ ] Activating a section header hides that category's issue rows (collapsed state)
- [ ] Activating the same header again restores visibility of that category's issue rows (expanded state)
- [ ] Collapsing one category does not affect the expand/collapse state of other categories
- [ ] After the view is unmounted and re-mounted, all sections return to the expanded state

**Dependencies:** R2

### R4: Preserved Functionality

**Description:** All existing capabilities of the issues view continue to work identically after grouping is introduced.

**Acceptance Criteria:**
- [ ] The following columns are present and populated for every issue row: key, type, title, status, priority, edit action
- [ ] The footer displays a total count equal to the sum of issues across all categories
- [ ] The create/edit detail panel opens and functions when the edit action or create action is triggered
- [ ] A loading indicator is displayed while issue data is being fetched
- [ ] An error message is displayed when issue data fails to load
- [ ] An empty state message is displayed when no issues exist

**Dependencies:** R1

## Out of Scope

- Text search or filtering within or across categories
- Sorting issues within a category
- Drag-and-drop reordering of issues or categories
- Persisting collapse state across page reloads or sessions
- Displaying a count badge on the parent navigation tab

## Cross-References

- See also: [cavekit-dynamic-issue-types](cavekit-dynamic-issue-types.md) -- R6 of that kit depends on this kit's R1 and specifies that new types not matching known categories fall into "Прочее"
