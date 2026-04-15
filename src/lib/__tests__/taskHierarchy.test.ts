import { describe, expect, it } from 'vitest';

import {
  buildTaskHierarchyGroups,
  buildTaskHierarchyTableRows,
  compareIssueFreshness,
  UNGROUPED_TASKS_ID,
  type TaskHierarchyTableRow,
} from '../taskHierarchy';
import type { JiraIssueShort } from '../../types';

function issue(patch: Partial<JiraIssueShort> & Pick<JiraIssueShort, 'key'>): JiraIssueShort {
  return {
    summary: patch.key,
    status: 'Backlog',
    priority: 'Нормальный',
    issuetype: 'Задача',
    ...patch,
  };
}

function collectIssueKeys(rows: TaskHierarchyTableRow[]): string[] {
  return rows.flatMap((row) => [
    ...(row.kind === 'issue' ? [row.issue.key] : []),
    ...collectIssueKeys(row.subRows),
  ]);
}

describe('task hierarchy helpers', () => {
  it('raises an old epic when it contains a fresh issue', () => {
    const groups = buildTaskHierarchyGroups([
      issue({ key: 'CREDITS-10', issuetype: 'Epic', created: '2026-01-01T00:00:00.000Z' }),
      issue({ key: 'CREDITS-11', epic_key: 'CREDITS-10', updated: '2026-04-15T08:00:00.000Z' }),
      issue({ key: 'CREDITS-20', issuetype: 'Epic', created: '2026-04-10T00:00:00.000Z' }),
      issue({ key: 'CREDITS-21', epic_key: 'CREDITS-20', updated: '2026-04-12T08:00:00.000Z' }),
    ]);

    expect(groups.map((group) => group.id)).toEqual(['CREDITS-10', 'CREDITS-20']);
    expect(groups[0].latestIssue?.key).toBe('CREDITS-11');
  });

  it('places a subtask under its parent inside the epic group', () => {
    const groups = buildTaskHierarchyGroups([
      issue({ key: 'CREDITS-1', issuetype: 'Epic' }),
      issue({ key: 'CREDITS-2', epic_key: 'CREDITS-1', updated: '2026-04-13T00:00:00.000Z' }),
      issue({
        key: 'CREDITS-3',
        issuetype: 'Подзадача',
        epic_key: 'CREDITS-1',
        parent_key: 'CREDITS-2',
        updated: '2026-04-15T00:00:00.000Z',
      }),
    ]);

    expect(groups[0].rows.map((row) => [row.issue.key, row.depth, row.parentFound])).toEqual([
      ['CREDITS-2', 0, false],
      ['CREDITS-3', 1, true],
    ]);
  });

  it('keeps an orphan subtask visible when the parent is missing', () => {
    const groups = buildTaskHierarchyGroups([
      issue({ key: 'CREDITS-1', issuetype: 'Epic' }),
      issue({
        key: 'CREDITS-4',
        issuetype: 'Подзадача',
        epic_key: 'CREDITS-1',
        parent_key: 'CREDITS-404',
      }),
    ]);

    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0]).toMatchObject({
      depth: 1,
      parentKey: 'CREDITS-404',
      parentFound: false,
    });
  });

  it('puts issues without epic into the ungrouped bucket', () => {
    const groups = buildTaskHierarchyGroups([
      issue({ key: 'CREDITS-8' }),
      issue({ key: 'CREDITS-9', epic_key: 'CREDITS-1' }),
    ]);

    expect(groups.map((group) => group.id)).toContain(UNGROUPED_TASKS_ID);
    expect(groups.find((group) => group.id === UNGROUPED_TASKS_ID)?.rows[0].issue.key).toBe('CREDITS-8');
  });

  it('falls back to issue key order when dates are missing', () => {
    const ordered = [issue({ key: 'CREDITS-2' }), issue({ key: 'CREDITS-12' })].sort(compareIssueFreshness);

    expect(ordered.map((item) => item.key)).toEqual(['CREDITS-12', 'CREDITS-2']);
  });

  it('builds TanStack rows with the orphan group first', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({ key: 'CREDITS-1', issuetype: 'Epic', updated: '2026-04-16T00:00:00.000Z' }),
      issue({ key: 'CREDITS-2', epic_key: 'CREDITS-1' }),
      issue({ key: 'CREDITS-3', updated: '2026-04-10T00:00:00.000Z' }),
    ]);

    expect(rows.map((row) => row.kind)).toEqual(['orphan-group', 'epic-group']);
    expect(rows[0]).toMatchObject({
      id: `group:${UNGROUPED_TASKS_ID}`,
      epicKey: null,
      title: 'Без эпика',
    });
    expect(rows[0].subRows.map((row) => row.issue?.key)).toEqual(['CREDITS-3']);
  });

  it('sorts TanStack groups and sibling rows by issue key descending', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({ key: 'CREDITS-10', issuetype: 'Epic' }),
      issue({ key: 'CREDITS-20', issuetype: 'Epic' }),
      issue({ key: 'CREDITS-11', epic_key: 'CREDITS-10' }),
      issue({ key: 'CREDITS-12', epic_key: 'CREDITS-10' }),
      issue({ key: 'CREDITS-21', epic_key: 'CREDITS-20' }),
      issue({ key: 'CREDITS-22', epic_key: 'CREDITS-20' }),
      issue({ key: 'CREDITS-13', issuetype: 'Подзадача', epic_key: 'CREDITS-10', parent_key: 'CREDITS-12' }),
      issue({ key: 'CREDITS-14', issuetype: 'Подзадача', epic_key: 'CREDITS-10', parent_key: 'CREDITS-12' }),
    ]);

    expect(rows.map((row) => row.epicKey)).toEqual(['CREDITS-20', 'CREDITS-10']);
    expect(rows[0].subRows.map((row) => row.issue?.key)).toEqual(['CREDITS-22', 'CREDITS-21']);
    expect(rows[1].subRows.map((row) => row.issue?.key)).toEqual(['CREDITS-12', 'CREDITS-11']);
    expect(rows[1].subRows[0].subRows.map((row) => row.issue?.key)).toEqual(['CREDITS-14', 'CREDITS-13']);
  });

  it('nests tasks and subtasks under their epic group', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({ key: 'CREDITS-1', issuetype: 'Epic' }),
      issue({ key: 'CREDITS-2', epic_key: 'CREDITS-1' }),
      issue({ key: 'CREDITS-3', issuetype: 'Подзадача', epic_key: 'CREDITS-1', parent_key: 'CREDITS-2' }),
    ]);

    expect(rows[0]).toMatchObject({ kind: 'epic-group', epicKey: 'CREDITS-1' });
    expect(rows[0].subRows[0]).toMatchObject({ kind: 'issue', parentKey: null, parentFound: false });
    expect(rows[0].subRows[0].issue?.key).toBe('CREDITS-2');
    expect(rows[0].subRows[0].subRows[0]).toMatchObject({
      kind: 'issue',
      parentKey: 'CREDITS-2',
      parentFound: true,
    });
    expect(rows[0].subRows[0].subRows[0].issue?.key).toBe('CREDITS-3');
  });

  it('inherits an epic bucket from a loaded parent when the child has no epic key', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({ key: 'CREDITS-9121', issuetype: 'Epic' }),
      issue({ key: 'CREDITS-9122', epic_key: 'CREDITS-9121' }),
      issue({ key: 'CREDITS-9131', issuetype: 'Подзадача', parent_key: 'CREDITS-9122' }),
    ]);

    expect(rows.map((row) => row.kind)).toEqual(['epic-group']);
    expect(rows[0]).toMatchObject({ kind: 'epic-group', epicKey: 'CREDITS-9121' });
    expect(rows[0].subRows[0].issue?.key).toBe('CREDITS-9122');
    expect(rows[0].subRows[0].subRows[0]).toMatchObject({
      kind: 'issue',
      parentKey: 'CREDITS-9122',
      parentFound: true,
    });
    expect(rows[0].subRows[0].subRows[0].issue?.key).toBe('CREDITS-9131');
  });

  it('keeps subtasks with a missing parent visible in the group', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({ key: 'CREDITS-1', issuetype: 'Epic' }),
      issue({ key: 'CREDITS-4', issuetype: 'Подзадача', epic_key: 'CREDITS-1', parent_key: 'CREDITS-404' }),
    ]);

    expect(rows[0].subRows[0]).toMatchObject({
      kind: 'issue',
      parentKey: 'CREDITS-404',
      parentFound: false,
    });
    expect(rows[0].subRows[0].issue?.key).toBe('CREDITS-4');
  });

  it('creates a synthetic epic group when the epic issue is missing', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({ key: 'CREDITS-9', epic_key: 'CREDITS-404' }),
    ]);

    expect(rows[0]).toMatchObject({
      kind: 'epic-group',
      epicKey: 'CREDITS-404',
      issue: null,
      isSynthetic: true,
      title: 'CREDITS-404',
    });
    expect(rows[0].subRows[0].issue?.key).toBe('CREDITS-9');
  });

  it('does not duplicate issues from nested children payloads', () => {
    const rows = buildTaskHierarchyTableRows([
      issue({
        key: 'CREDITS-2',
        children: [
          issue({ key: 'CREDITS-3', issuetype: 'Подзадача', parent_key: 'CREDITS-2' }),
        ],
      }),
      issue({ key: 'CREDITS-3', issuetype: 'Подзадача', parent_key: 'CREDITS-2' }),
    ]);

    expect(collectIssueKeys(rows)).toEqual(['CREDITS-2', 'CREDITS-3']);
  });
});
