import type {
  JiraIssueShort,
  JiraIssueDetailed,
  CreateIssueRequest,
  UpdateIssueRequest,
  AiGenerateResponse,
  OptimizeContext,
  ParentIssueContext,
  EpicIssueContext,
} from '../types';
import { getArrayField, getOptionalMeta, requestN8nJson, WEBHOOK_PATHS, type WebhookMeta } from './apiClient';
import { normalizeJiraIssue } from './apiNormalizers';

export interface JiraIssuesResponse {
  issues: JiraIssueShort[];
  meta: WebhookMeta | null;
}

export interface JiraIssueScoringSaveResponse {
  updated: string[];
  created: string[];
  skipped: Array<{ key: string; reason: string }>;
  meta: WebhookMeta | null;
}

export interface JiraIssueScoringUpdate {
  key: string;
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  rice_score: number | null;
  bug_risk: number | null;
  bug_process: number | null;
  bug_scale: number | null;
  bug_workaround: number | null;
  bug_score: number | null;
  td_impact: number | null;
  td_effort: number | null;
  td_roi: number | null;
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

export async function saveJiraIssueScores(
  n8nBaseUrl: string,
  updates: JiraIssueScoringUpdate[],
): Promise<JiraIssueScoringSaveResponse> {
  const data = await requestN8nJson<unknown>(n8nBaseUrl, WEBHOOK_PATHS.jiraIssueScoring, {
    method: 'POST',
    body: { updates },
  });

  const payload = (data && typeof data === 'object' ? data : {}) as {
    updated?: unknown;
    created?: unknown;
    skipped?: unknown;
  };

  const toStringArray = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  );

  const skipped = Array.isArray(payload.skipped)
    ? payload.skipped.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const key = typeof (item as { key?: unknown }).key === 'string' ? (item as { key: string }).key : '';
      const reason = typeof (item as { reason?: unknown }).reason === 'string' ? (item as { reason: string }).reason : '';
      if (!key) return [];
      return [{ key, reason }];
    })
    : [];

  return {
    updated: toStringArray(payload.updated),
    created: toStringArray(payload.created),
    skipped,
    meta: getOptionalMeta(data),
  };
}

export async function aiGenerate(
  n8nBaseUrl: string,
  issueType: string,
  userPrompt: string,
  context: { parent?: ParentIssueContext; epic?: EpicIssueContext } = {},
): Promise<AiGenerateResponse> {
  return requestN8nJson<AiGenerateResponse>(n8nBaseUrl, WEBHOOK_PATHS.aiGenerate, {
    method: 'POST',
    body: { issue_type: issueType, user_prompt: userPrompt, ...context },
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
  parent?: ParentIssueContext;
  epic?: EpicIssueContext;
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
