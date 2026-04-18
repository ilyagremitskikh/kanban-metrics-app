import { afterEach, describe, expect, it, vi } from 'vitest';

import { aiGenerate, createJiraIssue } from '../jiraApi';
import { WEBHOOK_PATHS } from '../apiClient';

describe('jiraApi AI and create contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends parent and epic context to the AI generate webhook', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: 'Сгенерировать дочерний scope',
        description: 'h2. Что сделать',
        priority: 'Нормальный',
        issuetype: 'Подзадача',
        checklists: [
          { name: 'Проверить контекст', checked: false, mandatory: true, rank: 0, isHeader: false },
        ],
      }),
    } as Response);

    const result = await aiGenerate('https://n8n.example.com', 'Подзадача', 'Нужна подзадача', {
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

    expect(fetchMock).toHaveBeenCalledWith(
      WEBHOOK_PATHS.aiGenerate,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          issue_type: 'Подзадача',
          user_prompt: 'Нужна подзадача',
          parent: {
            key: 'CREDITS-1',
            issuetype: 'Задача',
            summary: 'Родительская задача',
            description: 'Описание родителя',
            status: 'Бэклог',
            priority: 'Нормальный',
            labels: ['Партнерские_Интеграции'],
          },
        }),
      }),
    );
    expect(result.checklists).toHaveLength(1);
  });

  it('adds nested parent and epic refs to create requests for the live n8n workflow', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created', key: 'CREDITS-3' }),
    } as Response);

    await createJiraIssue('https://n8n.example.com', {
      summary: 'Дочерняя задача',
      description: 'Описание',
      priority: 'Нормальный',
      issuetype: 'Подзадача',
      needToUpdateSource: '',
      slService: '',
      productCatalog: '',
      parentKey: 'CREDITS-1',
      epicKey: 'CREDITS-2',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      WEBHOOK_PATHS.jiraIssues,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          summary: 'Дочерняя задача',
          description: 'Описание',
          priority: 'Нормальный',
          issuetype: 'Подзадача',
          needToUpdateSource: '',
          slService: '',
          productCatalog: '',
          parentKey: 'CREDITS-1',
          epicKey: 'CREDITS-2',
          parent: { key: 'CREDITS-1' },
          epic: { key: 'CREDITS-2' },
        }),
      }),
    );
  });

  it('treats a created response with a valid key as success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created', key: 'CREDITS-1' }),
    } as Response);

    await expect(createJiraIssue('https://n8n.example.com', {
      summary: 'Новая задача',
      description: 'Описание',
      priority: 'Нормальный',
      issuetype: 'Задача',
      needToUpdateSource: '',
      slService: '',
      productCatalog: '',
    })).resolves.toEqual({ status: 'created', key: 'CREDITS-1' });
  });

  it('throws when webhook returns an error status even with HTTP 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'error', message: 'Jira rejected payload' }),
    } as Response);

    await expect(createJiraIssue('https://n8n.example.com', {
      summary: 'Новая задача',
      description: 'Описание',
      priority: 'Нормальный',
      issuetype: 'Задача',
      needToUpdateSource: '',
      slService: '',
      productCatalog: '',
    })).rejects.toThrow('Jira rejected payload');
  });

  it('throws when webhook returns a null key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created', key: null }),
    } as Response);

    await expect(createJiraIssue('https://n8n.example.com', {
      summary: 'Новая задача',
      description: 'Описание',
      priority: 'Нормальный',
      issuetype: 'Задача',
      needToUpdateSource: '',
      slService: '',
      productCatalog: '',
    })).rejects.toThrow('Webhook не подтвердил создание задачи в Jira');
  });

  it('throws on an empty create response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await expect(createJiraIssue('https://n8n.example.com', {
      summary: 'Новая задача',
      description: 'Описание',
      priority: 'Нормальный',
      issuetype: 'Задача',
      needToUpdateSource: '',
      slService: '',
      productCatalog: '',
    })).rejects.toThrow('Webhook не подтвердил создание задачи в Jira');
  });
});
