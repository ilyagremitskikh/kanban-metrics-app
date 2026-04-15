import { describe, expect, it } from 'vitest';

import {
  applyRicePatchToSnapshot,
  applyTaskPatchToSnapshot,
  buildMetricsSnapshotKey,
  buildTasksSnapshotKey,
  createTasksSnapshot,
} from '../snapshots';
import type { Settings } from '../../types';

describe('snapshots helpers', () => {
  it('builds stable snapshot keys for metrics and tasks', () => {
    const settings: Settings = {
      n8nBaseUrl: 'https://n8n.example.com/',
      mode: 'standard',
      projectKey: ' CREDITS ',
      customJql: '',
    };

    expect(buildMetricsSnapshotKey(settings)).toBe('https://n8n.example.com::standard::CREDITS');
    expect(buildTasksSnapshotKey('https://n8n.example.com/')).toBe('https://n8n.example.com');
  });

  it('adds a created task into empty task snapshot', () => {
    const next = applyTaskPatchToSnapshot(null, 'https://n8n.example.com', {
      key: 'CRED-123',
      summary: 'Новая задача',
      issuetype: 'Задача',
      priority: 'Высокий',
      labels: ['one', 'two'],
    });

    expect(next.jiraIssues).toHaveLength(1);
    expect(next.riceIssues).toHaveLength(1);
    expect(next.jiraIssues[0]).toMatchObject({
      key: 'CRED-123',
      summary: 'Новая задача',
      issuetype: 'Задача',
      priority: 'Высокий',
      labels: ['one', 'two'],
    });
    expect(next.riceIssues[0]).toMatchObject({
      key: 'CRED-123',
      summary: 'Новая задача',
      issue_type: 'Задача',
      priority: 'Высокий',
      labels: 'one, two',
    });
    expect(next.meta.source).toBe('local');
    expect(next.meta.lastMutationAt).not.toBeNull();
  });

  it('updates only patched fields for edited task', () => {
    const snapshot = createTasksSnapshot(
      'https://n8n.example.com',
      [{
        key: 'CRED-123',
        summary: 'Старый summary',
        status: 'Backlog',
        priority: 'Нормальный',
        issuetype: 'Задача',
        labels: ['old'],
        parent_key: 'CRED-10',
        epic_key: 'CRED-EPIC-1',
      }],
      [{
        key: 'CRED-123',
        summary: 'Старый summary',
        issue_type: 'Задача',
        labels: 'old',
        priority: 'Нормальный',
        status: 'Backlog',
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
        td_impact: null,
        td_effort: null,
        td_roi: null,
      }],
      '2026-04-15T00:00:00.000Z',
    );

    const next = applyTaskPatchToSnapshot(snapshot, snapshot.key, {
      key: 'CRED-123',
      summary: 'Новый summary',
      labels: ['new'],
    });

    expect(next.jiraIssues[0]).toMatchObject({
      key: 'CRED-123',
      summary: 'Новый summary',
      status: 'Backlog',
      priority: 'Нормальный',
      labels: ['new'],
      parent_key: 'CRED-10',
      epic_key: 'CRED-EPIC-1',
    });
    expect(next.meta.lastSyncAt).toBe('2026-04-15T00:00:00.000Z');
  });

  it('updates hierarchy fields when the task patch includes parent or epic links', () => {
    const snapshot = createTasksSnapshot(
      'https://n8n.example.com',
      [{
        key: 'CRED-124',
        summary: 'Иерархическая задача',
        status: 'Backlog',
        priority: 'Нормальный',
        issuetype: 'Подзадача',
        parent_key: 'CRED-10',
        epic_key: 'CRED-EPIC-1',
      }],
      [{
        key: 'CRED-124',
        summary: 'Иерархическая задача',
        issue_type: 'Подзадача',
        labels: '',
        priority: 'Нормальный',
        status: 'Backlog',
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
        td_impact: null,
        td_effort: null,
        td_roi: null,
      }],
      '2026-04-15T00:00:00.000Z',
    );

    const next = applyTaskPatchToSnapshot(snapshot, snapshot.key, {
      key: 'CRED-124',
      parent_key: 'CRED-11',
      epic_key: 'CRED-EPIC-2',
    });

    expect(next.jiraIssues[0]).toMatchObject({
      key: 'CRED-124',
      parent_key: 'CRED-11',
      epic_key: 'CRED-EPIC-2',
    });
    expect(next.meta.lastSyncAt).toBe('2026-04-15T00:00:00.000Z');
  });

  it('applies rice updates to both jira and rice views', () => {
    const snapshot = createTasksSnapshot(
      'https://n8n.example.com',
      [{
        key: 'CRED-321',
        summary: 'Bug fix',
        status: 'In Progress',
        priority: 'Высокий',
        issuetype: 'Ошибка',
        bug_score: null,
      }],
      [{
        key: 'CRED-321',
        summary: 'Bug fix',
        issue_type: 'Ошибка',
        labels: '',
        priority: 'Высокий',
        status: 'In Progress',
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
        td_impact: null,
        td_effort: null,
        td_roi: null,
      }],
      '2026-04-15T00:00:00.000Z',
    );

    const next = applyRicePatchToSnapshot(snapshot, snapshot.key, {
      key: 'CRED-321',
      bug_risk: 40,
      bug_process: 30,
      bug_scale: 15,
      bug_workaround: 15,
      bug_score: 100,
    });

    expect(next.jiraIssues[0].bug_score).toBe(100);
    expect(next.riceIssues[0].bug_score).toBe(100);
    expect(next.meta.source).toBe('local');
  });
});
