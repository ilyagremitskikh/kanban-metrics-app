import type { RiceIssue } from '../types';

/** In dev mode, use relative paths so Vite proxy handles CORS. In prod, use full URL. */
function riceUrl(webhookUrl: string, path: string, n8nBaseUrl?: string): string {
  if (import.meta.env.DEV) return path;
  const base = (n8nBaseUrl?.trim() || new URL(webhookUrl).origin).replace(/\/$/, '');
  return `${base}${path}`;
}

export async function fetchRiceIssues(webhookUrl: string, n8nBaseUrl?: string): Promise<RiceIssue[]> {
  const res = await fetch(riceUrl(webhookUrl, '/webhook/rice-scoring', n8nBaseUrl));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.issues ?? []) as RiceIssue[];
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
  const res = await fetch(riceUrl(webhookUrl, '/webhook/rice-score-update', n8nBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
