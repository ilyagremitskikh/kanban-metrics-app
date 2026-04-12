import type { Issue, Settings, ThroughputIssueRaw } from '../types';
import { getArrayField, requestWebhookJson } from './apiClient';
import { normalizeIssue, normalizeThroughputIssue } from './apiNormalizers';

async function callWebhook(url: string, body: object): Promise<Issue[]> {
  const data = await requestWebhookJson<unknown>(url, 'POST', body);
  return getArrayField<unknown>(
    data,
    'issues',
    'Неожиданный формат ответа от n8n. Ожидается { issues: [...] }',
  ).map((item) => normalizeIssue(item as Parameters<typeof normalizeIssue>[0]));
}

export async function fetchIssues(
  settings: Settings,
  onProgress: (msg: string) => void,
): Promise<Issue[]> {
  const { webhookUrl, mode } = settings;

  onProgress('Запрашиваем данные из Jira через n8n…');

  if (mode === 'custom') {
    return callWebhook(webhookUrl, { customJql: settings.customJql });
  }

  return callWebhook(webhookUrl, {
    project: settings.projectKey,
  });
}

export async function fetchThroughputRaw(
  settings: Settings,
  onProgress: (msg: string) => void,
): Promise<ThroughputIssueRaw[]> {
  const { throughputWebhookUrl } = settings;
  if (!throughputWebhookUrl) throw new Error('throughputWebhookUrl не задан');
  onProgress('Загружаем throughput данные…');
  const data = await requestWebhookJson<unknown>(throughputWebhookUrl, 'GET');
  return getArrayField<unknown>(
    data,
    'data',
    'Неожиданный формат ответа throughput webhook. Ожидается { data: [...] }',
  ).map((item) => normalizeThroughputIssue(item as Parameters<typeof normalizeThroughputIssue>[0]));
}
