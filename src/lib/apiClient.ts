interface N8nRequestOptions {
  n8nBaseUrl?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toProxyUrl(fullUrl: string): string {
  if (!import.meta.env.DEV) return fullUrl;
  const u = new URL(fullUrl);
  return u.pathname + u.search;
}

function toN8nPathUrl(webhookUrl: string, path: string, n8nBaseUrl?: string): string {
  if (import.meta.env.DEV) return path;
  const base = (n8nBaseUrl?.trim() || new URL(webhookUrl).origin).replace(/\/$/, '');
  return `${base}${path}`;
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

export async function requestWebhookJson<T>(
  webhookUrl: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<T> {
  return requestJson<T>(toProxyUrl(webhookUrl), withJsonInit(method, body));
}

export async function requestN8nJson<T>(
  webhookUrl: string,
  path: string,
  options: N8nRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, n8nBaseUrl } = options;
  return requestJson<T>(toN8nPathUrl(webhookUrl, path, n8nBaseUrl), withJsonInit(method, body));
}

export function getArrayField<T>(data: unknown, key: string, errorMessage: string): T[] {
  if (!isRecord(data) || !Array.isArray(data[key])) throw new Error(errorMessage);
  return data[key] as T[];
}
