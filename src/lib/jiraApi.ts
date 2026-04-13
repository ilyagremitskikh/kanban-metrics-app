import type {
  JiraIssueShort,
  JiraIssueDetailed,
  CreateIssueRequest,
  UpdateIssueRequest,
  AiGenerateResponse,
  OptimizeContext,
} from '../types';
import { getArrayField, getOptionalMeta, requestN8nJson, WEBHOOK_PATHS, type WebhookMeta } from './apiClient';
import { normalizeJiraIssue } from './apiNormalizers';

export interface JiraIssuesResponse {
  issues: JiraIssueShort[];
  meta: WebhookMeta | null;
}

interface FetchJiraIssuesOptions {
  forceRefresh?: boolean;
}

function buildJiraIssuesPath({ forceRefresh = false }: FetchJiraIssuesOptions = {}): string {
  if (!forceRefresh) return WEBHOOK_PATHS.jiraIssues;

  const params = new URLSearchParams({
    refresh: '1',
    _ts: String(Date.now()),
  });

  return `${WEBHOOK_PATHS.jiraIssues}?${params.toString()}`;
}

export async function fetchJiraIssues(
  n8nBaseUrl: string,
  options: FetchJiraIssuesOptions = {},
): Promise<JiraIssuesResponse> {
  const data = await requestN8nJson<unknown>(n8nBaseUrl, buildJiraIssuesPath(options));
  return {
    issues: getArrayField<unknown>(data, 'issues', 'Неожиданный формат ответа Jira issues webhook')
      .map((issue) => normalizeJiraIssue(issue as Parameters<typeof normalizeJiraIssue>[0])),
    meta: getOptionalMeta(data),
  };
}

export async function fetchJiraIssueDetail(
  n8nBaseUrl: string,
  key: string,
): Promise<JiraIssueDetailed> {
  const data = await requestN8nJson<unknown>(
    n8nBaseUrl,
    `${WEBHOOK_PATHS.jiraIssues}?key=${encodeURIComponent(key)}`,
  );
  const issues = getArrayField<unknown>(data, 'issues', 'Неожиданный формат ответа Jira issue detail webhook')
    .map((issue) => normalizeJiraIssue(issue as Parameters<typeof normalizeJiraIssue>[0]) as JiraIssueDetailed);
  if (!issues[0]) throw new Error('Issue not found');
  return issues[0];
}

export async function createJiraIssue(
  n8nBaseUrl: string,
  data: CreateIssueRequest,
): Promise<{ status: string; key: string }> {
  return requestN8nJson<{ status: string; key: string }>(n8nBaseUrl, WEBHOOK_PATHS.jiraIssues, {
    method: 'POST',
    body: data,
  });
}

export async function updateJiraIssue(
  n8nBaseUrl: string,
  key: string,
  data: UpdateIssueRequest,
): Promise<{ status: string; key: string; updates: Record<string, unknown> }> {
  return requestN8nJson<{ status: string; key: string; updates: Record<string, unknown> }>(
    n8nBaseUrl,
    `${WEBHOOK_PATHS.jiraIssues}?key=${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      body: data,
    },
  );
}

export async function aiGenerate(
  n8nBaseUrl: string,
  issueType: string,
  userPrompt: string,
): Promise<AiGenerateResponse> {
  return requestN8nJson<AiGenerateResponse>(n8nBaseUrl, WEBHOOK_PATHS.aiGenerate, {
    method: 'POST',
    body: { issue_type: issueType, user_prompt: userPrompt },
  });
}

export async function aiOptimize(
  n8nBaseUrl: string,
  fieldType: 'summary' | 'description',
  text: string,
  context?: OptimizeContext,
): Promise<{ optimized_text: string }> {
  return requestN8nJson<{ optimized_text: string }>(n8nBaseUrl, WEBHOOK_PATHS.aiOptimize, {
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
  n8nBaseUrl: string,
  context: AiChecklistContext,
): Promise<import('../types').ChecklistItem[]> {
  const data = await requestN8nJson<unknown>(n8nBaseUrl, WEBHOOK_PATHS.aiChecklist, {
    method: 'POST',
    body: context,
  });
  if (!data || typeof data !== 'object' || !Array.isArray((data as { checklists?: unknown[] }).checklists)) {
    return [];
  }
  return (data as { checklists: import('../types').ChecklistItem[] }).checklists;
}
