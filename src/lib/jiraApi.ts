import type {
  JiraIssueShort,
  JiraIssueDetailed,
  CreateIssueRequest,
  UpdateIssueRequest,
  AiGenerateResponse,
  OptimizeContext,
} from '../types';

/** In dev mode, use relative paths so Vite proxy handles CORS. In prod, use full URL. */
function jiraUrl(webhookUrl: string, path: string, n8nBaseUrl?: string): string {
  if (import.meta.env.DEV) return path;
  const base = (n8nBaseUrl?.trim() || new URL(webhookUrl).origin).replace(/\/$/, '');
  return `${base}${path}`;
}

export async function fetchJiraIssues(webhookUrl: string, n8nBaseUrl?: string): Promise<JiraIssueShort[]> {
  const res = await fetch(jiraUrl(webhookUrl, '/webhook/jira/issues', n8nBaseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.issues ?? []) as JiraIssueShort[];
}

export async function fetchJiraIssueDetail(
  webhookUrl: string,
  key: string,
  n8nBaseUrl?: string,
): Promise<JiraIssueDetailed> {
  const res = await fetch(jiraUrl(webhookUrl, `/webhook/jira/issues?key=${encodeURIComponent(key)}`, n8nBaseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const issues = (data.issues ?? []) as JiraIssueDetailed[];
  if (!issues[0]) throw new Error('Issue not found');
  return issues[0];
}

export async function createJiraIssue(
  webhookUrl: string,
  data: CreateIssueRequest,
  n8nBaseUrl?: string,
): Promise<{ status: string; key: string }> {
  const res = await fetch(jiraUrl(webhookUrl, '/webhook/jira/issues', n8nBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateJiraIssue(
  webhookUrl: string,
  key: string,
  data: UpdateIssueRequest,
  n8nBaseUrl?: string,
): Promise<{ status: string; key: string; updates: Record<string, unknown> }> {
  const res = await fetch(
    jiraUrl(webhookUrl, `/webhook/jira/issues?key=${encodeURIComponent(key)}`, n8nBaseUrl),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function aiGenerate(
  webhookUrl: string,
  issueType: string,
  userPrompt: string,
  n8nBaseUrl?: string,
): Promise<AiGenerateResponse> {
  const res = await fetch(jiraUrl(webhookUrl, '/webhook/ai-generate', n8nBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_type: issueType, user_prompt: userPrompt }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function aiOptimize(
  webhookUrl: string,
  fieldType: 'summary' | 'description',
  text: string,
  context?: OptimizeContext,
  n8nBaseUrl?: string,
): Promise<{ optimized_text: string }> {
  const res = await fetch(jiraUrl(webhookUrl, '/webhook/ai-optimize', n8nBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_type: fieldType, text, ...context }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface AiChecklistContext {
  issue_type: string;
  summary: string;
  description: string;
}

export async function aiChecklist(
  webhookUrl: string,
  context: AiChecklistContext,
  n8nBaseUrl?: string,
): Promise<import('../types').ChecklistItem[]> {
  const res = await fetch(jiraUrl(webhookUrl, '/webhook/ai-checklist', n8nBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.checklists ?? []) as import('../types').ChecklistItem[];
}
