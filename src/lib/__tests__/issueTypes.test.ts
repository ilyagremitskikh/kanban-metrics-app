import { describe, expect, it } from 'vitest';

import {
  STANDARD_ISSUE_TYPES,
  getAvailableIssueTypes,
  getEpicChildTypeOptions,
  getStandaloneIssueTypeOptions,
  getSubtaskTypeOption,
} from '../issueTypes';

describe('issueTypes helpers', () => {
  it('exposes the standard Jira issue type set used by task forms', () => {
    expect(STANDARD_ISSUE_TYPES).toEqual([
      'Epic',
      'User Story',
      'Задача',
      'Ошибка',
      'Техдолг',
      'BUSINESS SUB-TASK',
      'Подзадача',
    ]);
  });

  it('builds available types from standard and actual issue types', () => {
    const availableTypes = getAvailableIssueTypes([
      { issuetype: 'User Story' },
      { issuetype: 'Research' },
      { issuetype: 'Задача' },
    ]);

    expect(availableTypes).toEqual([
      'Epic',
      'User Story',
      'Задача',
      'Ошибка',
      'Техдолг',
      'BUSINESS SUB-TASK',
      'Подзадача',
      'Research',
    ]);
  });

  it('returns only non-epic non-subtask types for epic children', () => {
    expect(getEpicChildTypeOptions(STANDARD_ISSUE_TYPES)).toEqual([
      'User Story',
      'Задача',
      'Ошибка',
      'Техдолг',
    ]);
  });

  it('excludes subtask-only types from standalone create options', () => {
    expect(getStandaloneIssueTypeOptions(STANDARD_ISSUE_TYPES)).toEqual([
      'Epic',
      'User Story',
      'Задача',
      'Ошибка',
      'Техдолг',
    ]);
  });

  it('falls back to the localized subtask type when none is available', () => {
    expect(getSubtaskTypeOption(['User Story', 'Задача'])).toBe('Подзадача');
  });
});
