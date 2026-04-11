import type { RiceIssue } from '../types';

/** In dev mode, use relative paths so Vite proxy handles CORS. In prod, use full URL. */
function riceUrl(webhookUrl: string, path: string): string {
  if (import.meta.env.DEV) return path;
  return `${new URL(webhookUrl).origin}${path}`;
}

export async function fetchRiceIssues(webhookUrl: string): Promise<RiceIssue[]> {
  const res = await fetch(riceUrl(webhookUrl, '/webhook/rice-scoring'));
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

export async function saveRiceScores(webhookUrl: string, updates: RiceUpdate[]): Promise<void> {
  const res = await fetch(riceUrl(webhookUrl, '/webhook/rice-score-update'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
