import type { RiceIssue } from '../types';
import { getArrayField, getOptionalMeta, requestN8nJson, WEBHOOK_PATHS, type WebhookMeta } from './apiClient';
import { normalizeRiceIssue } from './apiNormalizers';

export interface RiceIssuesResponse {
  issues: RiceIssue[];
  meta: WebhookMeta | null;
}

function dedupeRiceIssues(issues: RiceIssue[]): RiceIssue[] {
  const byKey = new Map<string, RiceIssue>();
  for (const issue of issues) {
    byKey.set(issue.key, issue);
  }
  return Array.from(byKey.values());
}

async function parseRiceIssues(
  data: unknown,
): Promise<RiceIssuesResponse> {
  return {
    issues: dedupeRiceIssues(
      getArrayField<unknown>(data, 'issues', 'Неожиданный формат ответа rice-scoring webhook')
        .map((issue) => normalizeRiceIssue(issue as Parameters<typeof normalizeRiceIssue>[0])),
    ),
    meta: getOptionalMeta(data),
  };
}

export async function fetchRiceIssues(n8nBaseUrl: string): Promise<RiceIssuesResponse> {
  const data = await requestN8nJson<unknown>(n8nBaseUrl, WEBHOOK_PATHS.riceScoring);
  return parseRiceIssues(data);
}

export async function refreshRiceIssues(n8nBaseUrl: string): Promise<RiceIssuesResponse> {
  const data = await requestN8nJson<unknown>(n8nBaseUrl, WEBHOOK_PATHS.riceScoringRefresh, {
    method: 'POST',
  });
  return parseRiceIssues(data);
}

export interface RiceUpdate {
  key: string;
  priority?: string;
  // RICE fields (User Story / Задача) — null для других типов
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  rice_score: number | null;
  // Bug fields (FinTech Defect Scoring) — null для других типов
  bug_risk:       number | null;
  bug_process:    number | null;
  bug_scale:      number | null;
  bug_workaround: number | null;
  bug_score:      number | null;
  // Tech Debt fields (Impact / Effort Matrix) — null для других типов
  td_impact: number | null;
  td_effort: number | null;
  td_roi:    number | null;
}

export async function saveRiceScores(n8nBaseUrl: string, updates: RiceUpdate[]): Promise<void> {
  await requestN8nJson<unknown>(n8nBaseUrl, WEBHOOK_PATHS.riceScoreUpdate, {
    method: 'POST',
    body: { updates },
  });
}
