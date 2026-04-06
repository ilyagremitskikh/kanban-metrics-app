import type { Issue, Settings } from '../types';
import { getMonthlyChunks } from './utils';

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
  const { webhookUrl, dateFrom, dateTo, mode } = settings;

  if (mode === 'custom') {
    onProgress('Запрашиваем данные из Jira через n8n…');
    return callWebhook(webhookUrl, {
      customJql: settings.customJql,
      dateFrom,
      dateTo,
    });
  }

  const chunks = getMonthlyChunks(new Date(dateFrom), new Date(dateTo));
  let allIssues: Issue[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    onProgress(`Загружаем ${chunk.label}… (${i + 1} из ${chunks.length})`);
    const issues = await callWebhook(webhookUrl, {
      project: settings.projectKey,
      issueTypes: settings.issueTypes,
      extraConditions: settings.extraConditions,
      dateFrom: chunk.from,
      dateTo: chunk.to,
    });
    allIssues = allIssues.concat(issues);
  }

  // Deduplicate by key
  const seen = new Set<string>();
  return allIssues.filter((i) => !seen.has(i.key) && seen.add(i.key));
}
