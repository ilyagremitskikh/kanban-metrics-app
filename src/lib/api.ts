import type { Issue, Settings, ThroughputIssueRaw } from '../types';

/** In dev mode, strip origin so Vite proxy handles CORS. In prod, keep full URL. */
function proxyUrl(fullUrl: string): string {
  if (import.meta.env.DEV) {
    const u = new URL(fullUrl);
    return u.pathname + u.search;
  }
  return fullUrl;
}

async function callWebhook(url: string, body: object): Promise<Issue[]> {
  const res = await fetch(proxyUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error('Неожиданный формат ответа от n8n. Ожидается { issues: [...] }');
  }
  return data.issues as Issue[];
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
    issueTypes: settings.issueTypes,
  });
}

export async function fetchThroughputRaw(
  settings: Settings,
  onProgress: (msg: string) => void,
): Promise<ThroughputIssueRaw[]> {
  const { throughputWebhookUrl } = settings;
  if (!throughputWebhookUrl) throw new Error('throughputWebhookUrl не задан');
  onProgress('Загружаем throughput данные…');
  const res = await fetch(proxyUrl(throughputWebhookUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (!data.data || !Array.isArray(data.data))
    throw new Error('Неожиданный формат ответа throughput webhook. Ожидается { data: [...] }');
  return data.data as ThroughputIssueRaw[];
}
