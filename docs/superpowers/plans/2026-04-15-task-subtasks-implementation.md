# Task Subtasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add child-task creation from the task edit flow, remove AI checklist generation, and surface parent/epic hierarchy in the task table.

**Architecture:** Extend the Jira issue model so hierarchy fields are normalized at the API boundary, then layer a dedicated child-task panel into the existing create/edit forms without changing the main screen flow. Keep checklist editing manual-only, and expose hierarchy in the table with lightweight presentational cells instead of a broader table refactor.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, TanStack Table, existing local n8n/Jira API wrappers

---

## File Structure

- Modify: `src/types.ts`
  Adds optional hierarchy fields (`parent`, `parent_key`, `epic`, `epic_key`, `children`) and create-request linkage fields (`parentKey`, `epicKey`).
- Modify: `src/lib/apiNormalizers.ts`
  Normalizes hierarchy payload from the flat Jira webhook response into stable front-end fields.
- Modify: `src/lib/jiraApi.ts`
  Keeps create/update contracts aligned with the new request shape and removes the AI checklist helper.
- Modify: `src/lib/issueTypes.ts`
  Adds helpers for epic/sub-task checks and type filtering for “create inside epic”.
- Modify: `src/components/IssueFormFields.tsx`
  Converts `ChecklistEditor` to a manual-only editor and removes checklist AI state.
- Create: `src/components/ChildIssuesPanel.tsx`
  Owns child creation UI, disabled create-state messaging, local submit state, and the compact child list.
- Modify: `src/components/CreateIssueForm.tsx`
  Removes AI checklist application, wires in disabled child panel, and keeps create flow unchanged until the parent exists.
- Modify: `src/components/EditIssueForm.tsx`
  Loads children from issue detail, wires in live child creation, and updates the local issue snapshot after child creation.
- Modify: `src/components/TaskTableCells.tsx`
  Adds presentational cells for parent/epic links and child relation badges.
- Modify: `src/components/IssuesTab.tsx`
  Adds `Родитель` and `Эпик` columns and updates sorting dependencies without changing current list/edit navigation.
- Test: `src/lib/__tests__/snapshots.test.ts`
  Verifies hierarchy fields survive snapshot patching.
- Create: `src/lib/__tests__/apiNormalizers.test.ts`
  Covers hierarchy normalization and optional-field fallbacks.

### Task 1: Extend Jira hierarchy types and normalization

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/apiNormalizers.ts`
- Create: `src/lib/__tests__/apiNormalizers.test.ts`
- Test: `src/lib/__tests__/snapshots.test.ts`

- [ ] **Step 1: Write the failing normalization test**

```ts
import { describe, expect, it } from 'vitest';

import { normalizeJiraIssue } from '../apiNormalizers';

describe('normalizeJiraIssue', () => {
  it('normalizes parent, epic and children hierarchy fields', () => {
    const issue = normalizeJiraIssue({
      key: 'CREDITS-9122',
      summary: 'Child issue',
      status: 'Готово к анализу',
      priority: 'Высокий',
      issuetype: 'Подзадача',
      parent: { key: 'CREDITS-9000' },
      epic: { key: 'CREDITS-8000' },
      epic_key: 'CREDITS-8000',
      children: [
        {
          key: 'CREDITS-9123',
          summary: 'Nested child',
          status: 'To Do',
          priority: 'Нормальный',
          issuetype: 'Подзадача',
        },
      ],
    });

    expect(issue.parent_key).toBe('CREDITS-9000');
    expect(issue.epic_key).toBe('CREDITS-8000');
    expect(issue.children).toHaveLength(1);
    expect(issue.children?.[0]?.key).toBe('CREDITS-9123');
  });

  it('keeps hierarchy fields optional when the webhook omits them', () => {
    const issue = normalizeJiraIssue({
      key: 'CREDITS-9124',
      summary: 'Standalone issue',
      status: 'To Do',
      priority: 'Нормальный',
      issuetype: 'Задача',
    });

    expect(issue.parent_key).toBeUndefined();
    expect(issue.epic_key).toBeUndefined();
    expect(issue.children).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/apiNormalizers.test.ts`
Expected: FAIL with a type error or assertion failure because hierarchy fields are not normalized yet.

- [ ] **Step 3: Add hierarchy fields to the shared issue contracts**

```ts
export interface JiraIssueRef {
  key: string;
}

export interface JiraIssueShort {
  key: string;
  summary: string;
  status: string;
  priority: string;
  issuetype: string;
  parent?: JiraIssueRef | null;
  parent_key?: string | null;
  epic?: JiraIssueRef | null;
  epic_key?: string | null;
  children?: JiraIssueShort[];
  score?: number | null;
  rice_score?: number | null;
  bug_score?: number | null;
  td_roi?: number | null;
  // ...
}

export interface CreateIssueRequest {
  summary: string;
  description: string;
  priority: string;
  issuetype: string;
  needToUpdateSource: string;
  slService: string;
  productCatalog: string;
  parentKey?: string;
  epicKey?: string;
  labels?: string[];
  checklists?: ChecklistItem[];
}
```

- [ ] **Step 4: Normalize parent/epic/children at the API boundary**

```ts
type RawJiraIssue = Partial<JiraIssueShort> & {
  issue_type?: string;
  issueType?: string;
  parent?: { key?: string | null } | null;
  epic?: { key?: string | null } | null;
  children?: RawJiraIssue[];
};

function normalizeIssueRef(value: { key?: string | null } | null | undefined) {
  return value?.key ? { key: value.key } : value ?? undefined;
}

export function normalizeJiraIssue(raw: RawJiraIssue): JiraIssueShort {
  const parent = normalizeIssueRef(raw.parent);
  const epic = normalizeIssueRef(raw.epic);

  return {
    ...raw,
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    status: raw.status ?? '',
    priority: raw.priority ?? '',
    issuetype: raw.issuetype ?? raw.issue_type ?? raw.issueType ?? '',
    parent,
    parent_key: raw.parent_key ?? parent?.key ?? undefined,
    epic,
    epic_key: raw.epic_key ?? epic?.key ?? undefined,
    children: Array.isArray(raw.children)
      ? raw.children.map((child) => normalizeJiraIssue(child))
      : undefined,
    score: toNumber(raw.score),
    rice_score: toNumber(raw.rice_score),
    bug_score: toNumber(raw.bug_score),
    td_roi: toNumber(raw.td_roi),
    reach: toNumber(raw.reach),
    impact: toNumber(raw.impact),
    confidence: toNumber(raw.confidence),
    effort: toNumber(raw.effort),
    bug_risk: toNumber(raw.bug_risk),
    bug_process: toNumber(raw.bug_process),
    bug_scale: toNumber(raw.bug_scale),
    bug_workaround: toNumber(raw.bug_workaround),
    td_impact: toNumber(raw.td_impact),
    td_effort: toNumber(raw.td_effort),
  };
}
```

- [ ] **Step 5: Protect snapshot patch behavior for hierarchy fields**

```ts
it('updates hierarchy fields when task patches include parent or epic links', () => {
  const updated = applyTaskMutationPatch(
    {
      key: 'tasks',
      jiraIssues: [
        {
          key: 'CREDITS-9122',
          summary: 'Child issue',
          status: 'To Do',
          priority: 'Нормальный',
          issuetype: 'Подзадача',
        },
      ],
      riceIssues: [],
      meta: baseMeta,
    },
    {
      key: 'CREDITS-9122',
      epic_key: 'CREDITS-8000',
      parent_key: 'CREDITS-9000',
    },
  );

  expect(updated.jiraIssues[0]).toMatchObject({
    key: 'CREDITS-9122',
    epic_key: 'CREDITS-8000',
    parent_key: 'CREDITS-9000',
  });
});
```

- [ ] **Step 6: Run the focused tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/apiNormalizers.test.ts src/lib/__tests__/snapshots.test.ts`
Expected: PASS with the new hierarchy assertions green.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/lib/apiNormalizers.ts src/lib/__tests__/apiNormalizers.test.ts src/lib/__tests__/snapshots.test.ts
git commit -m "feat: normalize jira hierarchy fields"
```

### Task 2: Remove AI checklist generation and keep checklist editing manual

**Files:**
- Modify: `src/components/IssueFormFields.tsx`
- Modify: `src/components/CreateIssueForm.tsx`
- Modify: `src/lib/jiraApi.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing manual-checklist test**

```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChecklistEditor } from '../../components/IssueFormFields';

describe('ChecklistEditor', () => {
  it('does not render AI checklist generation controls', () => {
    render(<ChecklistEditor value={[]} onChange={() => {}} />);

    expect(screen.queryByText('Сгенерировать чеклист')).not.toBeInTheDocument();
    expect(screen.getByText('Чеклист')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/components/__tests__/checklist-editor.test.tsx`
Expected: FAIL because there is no component test yet or the old AI control is still rendered.

- [ ] **Step 3: Convert ChecklistEditor into a manual-only component**

```tsx
interface ChecklistEditorProps {
  value: ChecklistItem[];
  onChange: (v: ChecklistItem[]) => void;
}

export function ChecklistEditor({ value, onChange }: ChecklistEditorProps) {
  const addItem = () => {
    onChange([
      ...value,
      {
        name: '',
        checked: false,
        mandatory: false,
        rank: value.length,
        isHeader: false,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Чеклист</Label>
        <Button type="button" onClick={addItem} variant="ghost" size="sm">
          <Plus size={14} />
          Добавить пункт
        </Button>
      </div>
      {/* existing checklist item list stays unchanged */}
    </div>
  );
}
```

- [ ] **Step 4: Remove checklist AI plumbing from the create flow and API wrapper**

```ts
export interface AiGenerateResponse {
  summary: string;
  description: string;
  priority: string;
  issuetype: string;
}
```

```ts
try {
  const result = await aiGenerate(n8nBaseUrl, aiIssueType, aiPrompt);
  setSummary(result.summary ?? '');
  setDescription(result.description ?? '');
  setPriority(normalizePriority(result.priority ?? 'Medium'));
  setIssuetype(result.issuetype ?? aiIssueType);
} catch {
  setAiError('Ошибка ИИ-генерации. Проверьте подключение и повторите.');
}
```

```ts
// delete this helper entirely
export async function aiChecklist(...) { ... }
```

- [ ] **Step 5: Run lint and the focused checklist test**

Run: `npm test -- --run src/components/__tests__/checklist-editor.test.tsx && npm run lint`
Expected: PASS with no remaining references to `aiChecklist` in the codebase.

- [ ] **Step 6: Commit**

```bash
git add src/components/IssueFormFields.tsx src/components/CreateIssueForm.tsx src/lib/jiraApi.ts src/types.ts src/components/__tests__/checklist-editor.test.tsx
git commit -m "refactor: remove ai checklist generation"
```

### Task 3: Add the child-task panel and wire it into edit/create forms

**Files:**
- Create: `src/components/ChildIssuesPanel.tsx`
- Modify: `src/components/EditIssueForm.tsx`
- Modify: `src/components/CreateIssueForm.tsx`
- Modify: `src/lib/issueTypes.ts`

- [ ] **Step 1: Write the failing child-panel behavior test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import ChildIssuesPanel from '../ChildIssuesPanel';

describe('ChildIssuesPanel', () => {
  it('shows a disabled hint when the parent issue has not been created yet', () => {
    render(
      <ChildIssuesPanel
        mode="create"
        parentIssue={null}
        availableTypes={['Epic', 'Задача', 'Подзадача']}
        n8nBaseUrl="https://example.test"
        onCreated={vi.fn()}
      />,
    );

    expect(screen.getByText('Сначала сохраните задачу, потом можно будет добавить дочерние элементы')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить подзадачу' })).toBeDisabled();
  });

  it('renders epic type selection without the Epic option', () => {
    render(
      <ChildIssuesPanel
        mode="edit"
        parentIssue={{ key: 'CREDITS-9121', issuetype: 'Epic', summary: 'Epic', status: 'To Do', priority: 'Нормальный' }}
        availableTypes={['Epic', 'Задача', 'Ошибка']}
        n8nBaseUrl="https://example.test"
        onCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить задачу в эпик' }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Epic' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/components/__tests__/child-issues-panel.test.tsx`
Expected: FAIL because the panel component does not exist yet.

- [ ] **Step 3: Add focused issue-type helpers for epic and sub-task behavior**

```ts
export function isEpicType(issuetype: string): boolean {
  return issuetype.trim().toLowerCase() === 'epic';
}

export function isSubtaskType(issuetype: string): boolean {
  return ['sub-task', 'подзадача', 'business sub-task'].includes(issuetype.trim().toLowerCase());
}

export function getEpicChildTypeOptions(availableTypes: string[]): string[] {
  return availableTypes.filter((type) => {
    const normalized = type.trim().toLowerCase();
    return normalized !== 'epic' && normalized !== 'подзадача' && normalized !== 'sub-task';
  });
}
```

- [ ] **Step 4: Implement the reusable child panel**

```tsx
export default function ChildIssuesPanel({
  mode,
  parentIssue,
  availableTypes,
  n8nBaseUrl,
  onCreated,
}: ChildIssuesPanelProps) {
  const isReady = Boolean(parentIssue?.key);
  const isEpic = isEpicType(parentIssue?.issuetype ?? '');
  const childTypes = isEpic ? getEpicChildTypeOptions(availableTypes) : ['Подзадача'];

  const request: CreateIssueRequest = {
    summary,
    description,
    priority,
    issuetype: isEpic ? selectedType : 'Подзадача',
    needToUpdateSource: '',
    slService: '',
    productCatalog: '',
    labels: labels.length ? labels : undefined,
    checklists: checklists.length ? checklists : undefined,
    parentKey: !isEpic && parentIssue ? parentIssue.key : undefined,
    epicKey: isEpic
      ? parentIssue?.key
      : parentIssue?.epic_key ?? undefined,
  };

  return (
    <FormSection title="Дочерние задачи">
      {!isReady ? (
        <Alert>
          <AlertDescription>Сначала сохраните задачу, потом можно будет добавить дочерние элементы</AlertDescription>
        </Alert>
      ) : null}
      {/* button row, inline child create form, compact children list */}
    </FormSection>
  );
}
```

- [ ] **Step 5: Wire the panel into create/edit forms**

```tsx
<ChildIssuesPanel
  mode="create"
  parentIssue={null}
  availableTypes={issueTypes}
  n8nBaseUrl={n8nBaseUrl}
  onCreated={() => {}}
/>
```

```tsx
<ChildIssuesPanel
  mode="edit"
  parentIssue={{
    key: issueKey,
    issuetype: fallbackIssueType,
    summary,
    status: initial.current?.status ?? '',
    priority,
    epic_key: initial.current?.epic_key,
    children: initial.current?.children ?? [],
  }}
  availableTypes={availableTypes}
  n8nBaseUrl={n8nBaseUrl}
  onCreated={(child) => {
    const nextChildren = [...(initial.current?.children ?? []), child];
    if (initial.current) initial.current = { ...initial.current, children: nextChildren };
  }}
/>;
```

- [ ] **Step 6: Run the child-panel test and a focused build check**

Run: `npm test -- --run src/components/__tests__/child-issues-panel.test.tsx && npm run build`
Expected: PASS with the panel compiling cleanly into both forms.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChildIssuesPanel.tsx src/components/EditIssueForm.tsx src/components/CreateIssueForm.tsx src/lib/issueTypes.ts src/components/__tests__/child-issues-panel.test.tsx
git commit -m "feat: add child issue panel to task forms"
```

### Task 4: Show parent and epic hierarchy in the task table

**Files:**
- Modify: `src/components/TaskTableCells.tsx`
- Modify: `src/components/IssuesTab.tsx`

- [ ] **Step 1: Write the failing hierarchy cell test**

```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ParentIssueCell, EpicIssueCell } from '../TaskTableCells';

describe('hierarchy cells', () => {
  it('renders linked parent and epic keys when present', () => {
    render(
      <>
        <ParentIssueCell parentKey="CREDITS-9000" />
        <EpicIssueCell epicKey="CREDITS-8000" />
      </>,
    );

    expect(screen.getByRole('link', { name: 'CREDITS-9000' })).toHaveAttribute('href', expect.stringContaining('/CREDITS-9000'));
    expect(screen.getByRole('link', { name: 'CREDITS-8000' })).toHaveAttribute('href', expect.stringContaining('/CREDITS-8000'));
  });

  it('renders a dash when hierarchy keys are missing', () => {
    render(
      <>
        <ParentIssueCell parentKey={undefined} />
        <EpicIssueCell epicKey={undefined} />
      </>,
    );

    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/components/__tests__/task-table-cells.test.tsx`
Expected: FAIL because the hierarchy cells do not exist yet.

- [ ] **Step 3: Add small hierarchy cell components**

```tsx
export function ParentIssueCell({ parentKey }: { parentKey?: string | null }) {
  if (!parentKey) return <span className="text-base text-gray-300">—</span>;
  return <IssueKeyCell issueKey={parentKey} className="pl-0" />;
}

export function EpicIssueCell({ epicKey }: { epicKey?: string | null }) {
  if (!epicKey) return <span className="text-base text-gray-300">—</span>;
  return <IssueKeyCell issueKey={epicKey} className="pl-0" />;
}
```

- [ ] **Step 4: Add `Родитель` and `Эпик` columns to the task table**

```tsx
{
  id: 'parent',
  header: 'Родитель',
  cell: ({ row }) => <ParentIssueCell parentKey={row.original.parent_key} />,
},
{
  id: 'epic',
  header: 'Эпик',
  cell: ({ row }) => <EpicIssueCell epicKey={row.original.epic_key} />,
},
```

- [ ] **Step 5: Run the hierarchy cell test and the main test suite**

Run: `npm test -- --run src/components/__tests__/task-table-cells.test.tsx src/lib/__tests__/apiNormalizers.test.ts src/lib/__tests__/snapshots.test.ts`
Expected: PASS with the table able to render hierarchy values or dashes.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskTableCells.tsx src/components/IssuesTab.tsx src/components/__tests__/task-table-cells.test.tsx
git commit -m "feat: show task hierarchy in issues table"
```

### Task 5: Final regression verification and polish

**Files:**
- Modify: `src/components/EditIssueForm.tsx`
- Modify: `src/components/CreateIssueForm.tsx`
- Modify: `src/components/ChildIssuesPanel.tsx`
- Test: `src/lib/__tests__/apiNormalizers.test.ts`
- Test: `src/lib/__tests__/snapshots.test.ts`

- [ ] **Step 1: Manually verify the live flows in dev mode**

Run: `npm run dev`
Expected: Vite starts and the task UI opens locally.

Checklist:

```text
1. Open an existing non-Epic task and confirm "Добавить подзадачу" is available.
2. Create a sub-task and confirm the parent form stays open and the new child appears in the local child list.
3. Open an Epic and confirm the create-inside-epic type picker hides Epic and sub-task types.
4. Open the create form for a new task and confirm the child panel is disabled with the saved-first hint.
5. Confirm the checklist UI no longer offers any AI generation actions.
6. Confirm the Issues table shows "Родитель" and "Эпик" columns with links where data exists.
```

- [ ] **Step 2: Run the full automated verification**

Run: `npm test && npm run lint && npm run build`
Expected: All commands PASS.

- [ ] **Step 3: Fix any remaining polish issues with the smallest possible patch**

```tsx
{submitError ? (
  <Alert variant="destructive" className="mb-3">
    <AlertDescription>{submitError}</AlertDescription>
  </Alert>
) : null}
```

Use this step only for concrete issues found in Step 1 or Step 2. Do not broaden scope.

- [ ] **Step 4: Re-run the exact failing command, then the full verification**

Run: `npm test && npm run lint && npm run build`
Expected: PASS after the minimal polish patch.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditIssueForm.tsx src/components/CreateIssueForm.tsx src/components/ChildIssuesPanel.tsx
git commit -m "test: verify task hierarchy flows"
```

## Self-Review

- Spec coverage check:
  - Child creation from regular task: covered by Task 3.
  - Epic child creation with filtered types: covered by Task 3.
  - Disabled child panel in create mode: covered by Task 3 and Task 5.
  - Manual-only checklist flow: covered by Task 2.
  - Parent/epic table columns: covered by Task 4.
  - Hierarchy contract and children payload: covered by Task 1.
- Placeholder scan:
  - No `TODO`, `TBD`, or “handle appropriately” placeholders remain.
  - Every code-changing step includes concrete code or a concrete checklist.
- Type consistency:
  - Plan uses `parentKey`/`epicKey` for create requests and `parent_key`/`epic_key` for hydrated issue payloads consistently.
  - `children` is only expected on hydrated issue detail objects, not update requests.
