import { describe, expect, it } from 'vitest';

import {
  buildChildAiContext,
  buildChildCreateLinks,
  buildChildOptimisticLinks,
  resolveChildAiDraft,
} from '../childIssueDraft';

describe('child issue AI helpers', () => {
  const parentIssue = {
    key: 'CREDITS-1',
    issuetype: 'Задача',
    summary: 'Родительская задача',
    description: 'Описание родителя',
    status: 'Бэклог',
    priority: 'Нормальный',
    labels: ['Партнерские_Интеграции'],
    epic_key: 'CREDITS-9',
  };

  it('builds parent context for subtasks', () => {
    expect(buildChildAiContext({ parentIssue, parentIsEpic: false })).toEqual({
      parent: {
        key: 'CREDITS-1',
        issuetype: 'Задача',
        summary: 'Родительская задача',
        description: 'Описание родителя',
        status: 'Бэклог',
        priority: 'Нормальный',
        labels: ['Партнерские_Интеграции'],
      },
    });
  });

  it('builds epic context for tickets inside an epic', () => {
    expect(buildChildAiContext({ parentIssue, parentIsEpic: true })).toEqual({
      epic: {
        key: 'CREDITS-1',
        issuetype: 'Задача',
        summary: 'Родительская задача',
        description: 'Описание родителя',
        status: 'Бэклог',
        priority: 'Нормальный',
        labels: ['Партнерские_Интеграции'],
      },
    });
  });

  it('applies AI fields and accepts only allowed epic child types', () => {
    const draft = resolveChildAiDraft({
      result: {
        summary: 'Добавить обработку ошибок',
        description: 'h2. Что сделать',
        priority: 'Высокий',
        issuetype: 'Ошибка',
        checklists: [
          { name: 'Проверить сценарий', checked: false, mandatory: true, rank: 0, isHeader: false },
        ],
      },
      parentIsEpic: true,
      currentType: 'Задача',
      allowedEpicTypes: ['User Story', 'Задача', 'Ошибка', 'Техдолг'],
      subtaskType: 'Подзадача',
    });

    expect(draft).toEqual({
      summary: 'Добавить обработку ошибок',
      description: 'h2. Что сделать',
      priority: 'Высокий',
      issuetype: 'Ошибка',
      checklists: [
        { name: 'Проверить сценарий', checked: false, mandatory: true, rank: 0, isHeader: false },
      ],
    });
  });

  it('keeps subtasks fixed to the subtask type even if AI returns another type', () => {
    const draft = resolveChildAiDraft({
      result: {
        summary: 'Доработать API',
        description: 'h2. Что сделать',
        priority: 'Нормальный',
        issuetype: 'Задача',
      },
      parentIsEpic: false,
      currentType: '',
      allowedEpicTypes: ['User Story', 'Задача'],
      subtaskType: 'Подзадача',
    });

    expect(draft.issuetype).toBe('Подзадача');
  });

  it('creates subtasks with only parent link because Jira inherits epic from parent', () => {
    expect(buildChildCreateLinks({ parentKey: 'CREDITS-9123', parentIsEpic: false })).toEqual({
      parentKey: 'CREDITS-9123',
      parent: { key: 'CREDITS-9123' },
    });
  });

  it('creates epic children with only epic link', () => {
    expect(buildChildCreateLinks({ parentKey: 'CREDITS-9121', parentIsEpic: true })).toEqual({
      epicKey: 'CREDITS-9121',
      epic: { key: 'CREDITS-9121' },
    });
  });

  it('keeps inherited epic in optimistic subtask state without sending it to create', () => {
    expect(buildChildOptimisticLinks({
      parentKey: 'CREDITS-9123',
      parentIsEpic: false,
      parentEpicKey: 'CREDITS-9121',
    })).toEqual({
      parentKey: 'CREDITS-9123',
      epicKey: 'CREDITS-9121',
    });
  });
});
