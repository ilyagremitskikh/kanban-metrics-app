import type { Issue, Settings, ThroughputIssueRaw } from '../types';
import { getArrayField, getOptionalMeta, requestN8nJson, WEBHOOK_PATHS, type WebhookMeta } from './apiClient';
import { normalizeIssue, normalizeThroughputIssue } from './apiNormalizers';
import { buildMetricsRequestBody } from './metricsQuery';

export interface MetricsIssuesResponse {
  issues: Issue[];
  meta: WebhookMeta | null;
}

export async function fetchIssues(
  settings: Settings,
  onProgress: (msg: string) => void,
): Promise<MetricsIssuesResponse> {
  const { n8nBaseUrl } = settings;

  onProgress('Запрашиваем данные из Jira через n8n…');
  const data = await requestN8nJson<unknown>(n8nBaseUrl, WEBHOOK_PATHS.kanbanMetrics, {
    method: 'POST',
    body: buildMetricsRequestBody(settings),
  });
  return {
    issues: getArrayField<unknown>(
      data,
      'issues',
      'Неожиданный формат ответа от n8n. Ожидается { issues: [...] }',
    ).map((item) => normalizeIssue(item as Parameters<typeof normalizeIssue>[0])),
    meta: getOptionalMeta(data),
  };
}

export async function fetchThroughputRaw(
  settings: Settings,
  onProgress: (msg: string) => void,
): Promise<ThroughputIssueRaw[]> {
  onProgress('Загружаем throughput данные…');
  const data = await requestN8nJson<unknown>(settings.n8nBaseUrl, WEBHOOK_PATHS.throughput);
  return getArrayField<unknown>(
    data,
    'data',
    'Неожиданный формат ответа throughput webhook. Ожидается { data: [...] }',
  ).map((item) => normalizeThroughputIssue(item as Parameters<typeof normalizeThroughputIssue>[0]));
}
