import type { RiceIssue } from '../types';
import { getArrayField, requestN8nJson } from './apiClient';
import { normalizeRiceIssue } from './apiNormalizers';

export async function fetchRiceIssues(webhookUrl: string, n8nBaseUrl?: string): Promise<RiceIssue[]> {
  const data = await requestN8nJson<unknown>(webhookUrl, '/webhook/rice-scoring', { n8nBaseUrl });
  return getArrayField<unknown>(data, 'issues', 'Неожиданный формат ответа rice-scoring webhook')
    .map((issue) => normalizeRiceIssue(issue as Parameters<typeof normalizeRiceIssue>[0]));
}

export interface RiceUpdate {
  key: string;
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

export async function saveRiceScores(webhookUrl: string, updates: RiceUpdate[], n8nBaseUrl?: string): Promise<void> {
  await requestN8nJson<unknown>(webhookUrl, '/webhook/rice-score-update', {
    n8nBaseUrl,
    method: 'POST',
    body: { updates },
  });
}
