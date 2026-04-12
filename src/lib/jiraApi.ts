import type {
  JiraIssueShort,
  JiraIssueDetailed,
  CreateIssueRequest,
  UpdateIssueRequest,
  AiGenerateResponse,
  OptimizeContext,
} from '../types';
import { getArrayField, requestN8nJson } from './apiClient';
import { normalizeJiraIssue } from './apiNormalizers';

export async function fetchJiraIssues(webhookUrl: string, n8nBaseUrl?: string): Promise<JiraIssueShort[]> {
  const data = await requestN8nJson<unknown>(webhookUrl, '/webhook/jira/issues', { n8nBaseUrl });
  return getArrayField<unknown>(data, 'issues', 'Неожиданный формат ответа Jira issues webhook')
    .map((issue) => normalizeJiraIssue(issue as Parameters<typeof normalizeJiraIssue>[0]));
}

export async function fetchJiraIssueDetail(
  webhookUrl: string,
  key: string,
  n8nBaseUrl?: string,
): Promise<JiraIssueDetailed> {
  const data = await requestN8nJson<unknown>(
    webhookUrl,
    `/webhook/jira/issues?key=${encodeURIComponent(key)}`,
    { n8nBaseUrl },
  );
  const issues = getArrayField<unknown>(data, 'issues', 'Неожиданный формат ответа Jira issue detail webhook')
    .map((issue) => normalizeJiraIssue(issue as Parameters<typeof normalizeJiraIssue>[0]) as JiraIssueDetailed);
  if (!issues[0]) throw new Error('Issue not found');
  return issues[0];
}

export async function createJiraIssue(
  webhookUrl: string,
  data: CreateIssueRequest,
  n8nBaseUrl?: string,
): Promise<{ status: string; key: string }> {
  return requestN8nJson<{ status: string; key: string }>(webhookUrl, '/webhook/jira/issues', {
    n8nBaseUrl,
    method: 'POST',
    body: data,
  });
}

export async function updateJiraIssue(
  webhookUrl: string,
  key: string,
  data: UpdateIssueRequest,
  n8nBaseUrl?: string,
): Promise<{ status: string; key: string; updates: Record<string, unknown> }> {
  return requestN8nJson<{ status: string; key: string; updates: Record<string, unknown> }>(
    webhookUrl,
    `/webhook/jira/issues?key=${encodeURIComponent(key)}`,
    {
      n8nBaseUrl,
      method: 'PATCH',
      body: data,
    },
  );
}

export async function aiGenerate(
  webhookUrl: string,
  issueType: string,
  userPrompt: string,
  n8nBaseUrl?: string,
): Promise<AiGenerateResponse> {
  return requestN8nJson<AiGenerateResponse>(webhookUrl, '/webhook/ai-generate', {
    n8nBaseUrl,
    method: 'POST',
    body: { issue_type: issueType, user_prompt: userPrompt },
  });
}

export async function aiOptimize(
  webhookUrl: string,
  fieldType: 'summary' | 'description',
  text: string,
  context?: OptimizeContext,
  n8nBaseUrl?: string,
): Promise<{ optimized_text: string }> {
  return requestN8nJson<{ optimized_text: string }>(webhookUrl, '/webhook/ai-optimize', {
    n8nBaseUrl,
    method: 'POST',
    body: { field_type: fieldType, text, ...context },
  });
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
  const data = await requestN8nJson<unknown>(webhookUrl, '/webhook/ai-checklist', {
    n8nBaseUrl,
    method: 'POST',
    body: context,
  });
  if (!data || typeof data !== 'object' || !Array.isArray((data as { checklists?: unknown[] }).checklists)) {
    return [];
  }
  return (data as { checklists: import('../types').ChecklistItem[] }).checklists;
}
