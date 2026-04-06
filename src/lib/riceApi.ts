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
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  rice_score: number;
}

export async function saveRiceScores(webhookUrl: string, updates: RiceUpdate[]): Promise<void> {
  const res = await fetch(riceUrl(webhookUrl, '/webhook/rice-score-update'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
