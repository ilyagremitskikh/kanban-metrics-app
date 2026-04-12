export const WEBHOOK_PATHS = {
  kanbanMetrics: '/webhook/kanban-metrics',
  jiraIssues: '/webhook/jira/issues',
  throughput: '/webhook/throughput',
  riceScoring: '/webhook/rice-scoring',
  riceScoreUpdate: '/webhook/rice-score-update',
  aiGenerate: '/webhook/ai-generate',
  aiOptimize: '/webhook/ai-optimize',
  aiChecklist: '/webhook/ai-checklist',
} as const;

interface N8nRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildUrl(n8nBaseUrl: string, path: string): string {
  if (import.meta.env.DEV) return path;
  return `${n8nBaseUrl.replace(/\/$/, '')}${path}`;
}

function withJsonInit(method: string, body?: unknown): RequestInit {
  if (body === undefined) return { method };
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return (await res.json()) as T;
}

export async function requestN8nJson<T>(
  n8nBaseUrl: string,
  path: string,
  options: N8nRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body } = options;
  return requestJson<T>(buildUrl(n8nBaseUrl, path), withJsonInit(method, body));
}

export function getArrayField<T>(data: unknown, key: string, errorMessage: string): T[] {
  if (!isRecord(data) || !Array.isArray(data[key])) throw new Error(errorMessage);
  return data[key] as T[];
}
