import { describe, expect, it } from 'vitest';

import { normalizeJiraIssue } from '../apiNormalizers';

describe('normalizeJiraIssue', () => {
  it('normalizes parent, epic, epic_key, and children recursively', () => {
    const normalized = normalizeJiraIssue({
      key: 'TASK-1',
      summary: 'Parent issue',
      status: 'In Progress',
      priority: 'High',
      issuetype: 'Task',
      parent: { key: 'TASK-0' },
      epic: { key: 'EPIC-1' },
      children: [
        {
          key: 'TASK-2',
          summary: 'Child issue',
          status: 'To Do',
          priority: 'Low',
          issuetype: 'Sub-task',
          parent: { key: 'TASK-1' },
        },
      ],
    });

    expect(normalized).toMatchObject({
      key: 'TASK-1',
      parent: { key: 'TASK-0' },
      parent_key: 'TASK-0',
      epic: { key: 'EPIC-1' },
      epic_key: 'EPIC-1',
    });
    expect(normalized.children).toHaveLength(1);
    expect(normalized.children?.[0]).toMatchObject({
      key: 'TASK-2',
      parent: { key: 'TASK-1' },
      parent_key: 'TASK-1',
    });
  });

  it('keeps hierarchy fields optional when missing', () => {
    const normalized = normalizeJiraIssue({
      key: 'TASK-3',
      summary: 'Plain issue',
      status: 'Open',
      priority: 'Medium',
      issuetype: 'Task',
    });

    expect(normalized.parent).toBeUndefined();
    expect(normalized.parent_key).toBeUndefined();
    expect(normalized.epic).toBeUndefined();
    expect(normalized.epic_key).toBeUndefined();
    expect(normalized.children).toBeUndefined();
  });

  it('normalizes camelCase hierarchy keys from API payloads', () => {
    const normalized = normalizeJiraIssue({
      key: 'TASK-4',
      summary: 'Camel hierarchy',
      status: 'Open',
      priority: 'Medium',
      issuetype: 'Sub-task',
      parentKey: 'TASK-1',
      epicKey: 'EPIC-2',
    });

    expect(normalized.parent_key).toBe('TASK-1');
    expect(normalized.epic_key).toBe('EPIC-2');
  });
});
