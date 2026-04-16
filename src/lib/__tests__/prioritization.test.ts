import { describe, expect, it } from 'vitest';

import {
  buildPrioritizationHierarchy,
  buildScoreInheritanceUpdates,
  preparePrioritizationData,
  toPrioritizationIssueType,
} from '../prioritization';
import type { RiceIssue } from '../../types';

function issue(patch: Partial<RiceIssue> & Pick<RiceIssue, 'key'>): RiceIssue {
  return {
    key: patch.key,
    summary: patch.summary ?? patch.key,
    issue_type: patch.issue_type ?? 'Задача',
    labels: patch.labels ?? '',
    priority: patch.priority ?? 'Нормальный',
    status: patch.status ?? 'Backlog',
    parent: patch.parent,
    parent_key: patch.parent_key,
    epic: patch.epic,
    epic_key: patch.epic_key,
    reach: patch.reach ?? null,
    impact: patch.impact ?? null,
    confidence: patch.confidence ?? null,
    effort: patch.effort ?? null,
    rice_score: patch.rice_score ?? null,
    bug_risk: patch.bug_risk ?? null,
    bug_process: patch.bug_process ?? null,
    bug_scale: patch.bug_scale ?? null,
    bug_workaround: patch.bug_workaround ?? null,
    bug_score: patch.bug_score ?? null,
    td_impact: patch.td_impact ?? null,
    td_effort: patch.td_effort ?? null,
    td_roi: patch.td_roi ?? null,
  };
}

describe('prioritization helpers', () => {
  it('normalizes English and Russian issue types', () => {
    expect(toPrioritizationIssueType('Story')).toBe('Story');
    expect(toPrioritizationIssueType('User Story')).toBe('Story');
    expect(toPrioritizationIssueType('Пользовательская история')).toBe('Story');
    expect(toPrioritizationIssueType('Task')).toBe('Task');
    expect(toPrioritizationIssueType('Задача')).toBe('Task');
    expect(toPrioritizationIssueType('Bug')).toBe('Bug');
    expect(toPrioritizationIssueType('Ошибка')).toBe('Bug');
    expect(toPrioritizationIssueType('TechDebt')).toBe('TechDebt');
    expect(toPrioritizationIssueType('Tech Debt')).toBe('TechDebt');
    expect(toPrioritizationIssueType('Техдолг')).toBe('TechDebt');
    expect(toPrioritizationIssueType('Sub-task')).toBe('Subtask');
    expect(toPrioritizationIssueType('Подзадача')).toBe('Subtask');
  });

  it('segregates visible data and excludes subtasks', () => {
    const prepared = preparePrioritizationData([
      issue({ key: 'APP-1', issue_type: 'User Story' }),
      issue({ key: 'APP-2', issue_type: 'Task' }),
      issue({ key: 'APP-3', issue_type: 'Bug' }),
      issue({ key: 'APP-4', issue_type: 'TechDebt' }),
      issue({ key: 'APP-5', issue_type: 'Sub-task', parent_key: 'APP-2' }),
    ]);

    expect(prepared.featuresData.map((i) => i.key)).toEqual(['APP-1', 'APP-2']);
    expect(prepared.bugsData.map((i) => i.key)).toEqual(['APP-3']);
    expect(prepared.techDebtData.map((i) => i.key)).toEqual(['APP-4']);
    expect(prepared.allById.get('APP-5')?.type).toBe('Subtask');
  });

  it('enriches feature rows with epic metadata through direct epic keys and parent chains', () => {
    const prepared = preparePrioritizationData([
      issue({ key: 'APP-EPIC', issue_type: 'Epic', summary: 'Credit onboarding' }),
      issue({ key: 'APP-1', issue_type: 'Task', epic_key: 'APP-EPIC' }),
      issue({ key: 'APP-2', issue_type: 'Task', parent_key: 'APP-1' }),
    ]);

    expect(prepared.featuresData.find((i) => i.key === 'APP-1')?.epic).toMatchObject({
      id: 'APP-EPIC',
      title: 'Credit onboarding',
    });
    expect(prepared.featuresData.find((i) => i.key === 'APP-2')?.epic).toMatchObject({
      id: 'APP-EPIC',
      title: 'Credit onboarding',
    });
  });

  it('keeps direct epic metadata even when the epic issue is not loaded', () => {
    const prepared = preparePrioritizationData([
      issue({ key: 'APP-1', issue_type: 'Task', epic_key: 'APP-404' }),
    ]);

    expect(prepared.featuresData[0].parentEpicId).toBe('APP-404');
    expect(prepared.featuresData[0].epic).toEqual({
      id: 'APP-404',
      key: 'APP-404',
      title: 'APP-404',
    });
  });

  it('builds hierarchy groups from sorted visible issues and keeps child order', () => {
    const prepared = preparePrioritizationData([
      issue({ key: 'APP-EPIC', issue_type: 'Epic', summary: 'Loaded epic' }),
      issue({ key: 'APP-1', issue_type: 'Task', epic_key: 'APP-EPIC' }),
      issue({ key: 'APP-2', issue_type: 'Task', epic_key: 'APP-EPIC' }),
      issue({ key: 'APP-3', issue_type: 'Task', epic_key: 'APP-404' }),
      issue({ key: 'APP-4', issue_type: 'Task' }),
      issue({ key: 'APP-5', issue_type: 'Sub-task', parent_key: 'APP-1', epic_key: 'APP-EPIC' }),
    ]);

    const rows = buildPrioritizationHierarchy([
      prepared.featuresData.find((i) => i.key === 'APP-2')!,
      prepared.featuresData.find((i) => i.key === 'APP-1')!,
      prepared.featuresData.find((i) => i.key === 'APP-3')!,
      prepared.featuresData.find((i) => i.key === 'APP-4')!,
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: 'group', epicKey: 'APP-EPIC', title: 'Loaded epic', isOrphan: false });
    expect(rows[0].kind === 'group' ? rows[0].subRows.map((row) => row.key) : []).toEqual(['APP-2', 'APP-1']);
    expect(rows[1]).toMatchObject({ kind: 'group', epicKey: 'APP-404', title: 'APP-404', isSynthetic: true });
    expect(rows[2]).toMatchObject({ kind: 'group', epicKey: null, title: 'Без эпика', isOrphan: true });
  });

  it('preserves global sorted order when the same epic appears in multiple segments', () => {
    const prepared = preparePrioritizationData([
      issue({ key: 'EPIC-A', issue_type: 'Epic', summary: 'Epic A' }),
      issue({ key: 'EPIC-B', issue_type: 'Epic', summary: 'Epic B' }),
      issue({ key: 'APP-1', issue_type: 'Task', epic_key: 'EPIC-A' }),
      issue({ key: 'APP-2', issue_type: 'Task', epic_key: 'EPIC-B' }),
      issue({ key: 'APP-3', issue_type: 'Task', epic_key: 'EPIC-A' }),
    ]);

    const rows = buildPrioritizationHierarchy([
      prepared.featuresData.find((i) => i.key === 'APP-1')!,
      prepared.featuresData.find((i) => i.key === 'APP-2')!,
      prepared.featuresData.find((i) => i.key === 'APP-3')!,
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.kind === 'group' ? row.subRows[0]?.key : row.key)).toEqual(['APP-1', 'APP-2', 'APP-3']);
    expect(rows.map((row) => row.kind === 'group' ? row.epicKey : null)).toEqual(['EPIC-A', 'EPIC-B', 'EPIC-A']);
  });

  it('builds recursive RICE inheritance updates for subtasks only', () => {
    const prepared = preparePrioritizationData([
      issue({ key: 'APP-1', issue_type: 'Task', priority: 'Высокий' }),
      issue({ key: 'APP-2', issue_type: 'Sub-task', parent_key: 'APP-1' }),
      issue({ key: 'APP-3', issue_type: 'Sub-task', parent_key: 'APP-2' }),
      issue({ key: 'APP-4', issue_type: 'Sub-task', parent_key: 'APP-404' }),
    ]);

    const updates = buildScoreInheritanceUpdates({
      key: 'APP-1',
      priority: 'Высокий',
      reach: 100,
      impact: 2,
      confidence: 80,
      effort: 5,
      rice_score: 32,
      bug_risk: null,
      bug_process: null,
      bug_scale: null,
      bug_workaround: null,
      bug_score: null,
      td_impact: null,
      td_effort: null,
      td_roi: null,
    }, prepared.allById.values());

    expect(updates.map((update) => update.key)).toEqual(['APP-1', 'APP-2', 'APP-3']);
    expect(updates[1]).toMatchObject({ priority: 'Высокий', reach: 100, impact: 2, confidence: 80, effort: 5, rice_score: 32 });
    expect(updates[2]).toMatchObject({ priority: 'Высокий', reach: 100, impact: 2, confidence: 80, effort: 5, rice_score: 32 });
  });

  it('copies bug and tech debt score models to descendants', () => {
    const bugPrepared = preparePrioritizationData([
      issue({ key: 'BUG-1', issue_type: 'Bug', priority: 'Highest' }),
      issue({ key: 'BUG-2', issue_type: 'Subtask', parent_key: 'BUG-1' }),
    ]);
    const bugUpdates = buildScoreInheritanceUpdates({
      key: 'BUG-1',
      priority: 'Highest',
      reach: null,
      impact: null,
      confidence: null,
      effort: null,
      rice_score: null,
      bug_risk: 40,
      bug_process: 30,
      bug_scale: 15,
      bug_workaround: 15,
      bug_score: 100,
      td_impact: null,
      td_effort: null,
      td_roi: null,
    }, bugPrepared.allById.values());

    expect(bugUpdates[1]).toMatchObject({ key: 'BUG-2', priority: 'Highest', bug_score: 100, bug_risk: 40 });

    const tdPrepared = preparePrioritizationData([
      issue({ key: 'TD-1', issue_type: 'Tech Debt', priority: 'Medium' }),
      issue({ key: 'TD-2', issue_type: 'Подзадача', parent_key: 'TD-1' }),
    ]);
    const tdUpdates = buildScoreInheritanceUpdates({
      key: 'TD-1',
      priority: 'Medium',
      reach: null,
      impact: null,
      confidence: null,
      effort: null,
      rice_score: null,
      bug_risk: null,
      bug_process: null,
      bug_scale: null,
      bug_workaround: null,
      bug_score: null,
      td_impact: 8,
      td_effort: 2,
      td_roi: 4,
    }, tdPrepared.allById.values());

    expect(tdUpdates[1]).toMatchObject({ key: 'TD-2', priority: 'Medium', td_impact: 8, td_effort: 2, td_roi: 4 });
  });
});
