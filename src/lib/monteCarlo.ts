import { percentile } from './utils';
import type { QueueForecastMode, ThroughputWeek } from '../types';

export interface QueueItemResult {
  name: string;
  p50: Date;
  p85: Date;
  p95: Date;
}

export interface WipAgingEntry {
  age: number;
}

export interface MCResult {
  p50: number;
  p85: number;
  p95: number;
  histogram: { from: number; to: number; count: number; color: string }[];
}

export const MC_HISTORY_START_DATE = '2026-01-12';
export const DEFAULT_WIP_RESIDUAL_FACTOR = 0.6;
export const DEFAULT_AGING_FLOOR = 0.25;

function simulate(samples: number[], N: number, getCount: (s: number[]) => number): number[] {
  const results: number[] = [];
  for (let i = 0; i < N; i++) {
    results.push(getCount(samples));
  }
  results.sort((a, b) => a - b);
  return results;
}

export function runMCItems(
  samples: number[],
  target: number,
  N = 10_000,
): MCResult {
  const results = simulate(samples, N, (s) => {
    let weeks = 0, done = 0;
    while (done < target) {
      done += s[Math.floor(Math.random() * s.length)];
      weeks++;
      if (weeks > 520) break;
    }
    return weeks;
  });

  return buildResult(results);
}

export function runMCDate(
  samples: number[],
  targetDate: Date,
  N = 10_000,
): MCResult {
  const weeksAvail = Math.max(
    1,
    Math.ceil((targetDate.getTime() - Date.now()) / (7 * 86_400_000)),
  );
  const results = simulate(samples, N, (s) => {
    let done = 0;
    for (let w = 0; w < weeksAvail; w++) {
      done += s[Math.floor(Math.random() * s.length)];
    }
    return done;
  });

  return buildResult(results);
}

function buildResult(sortedResults: number[]): MCResult {
  const p50 = percentile(sortedResults, 50)!;
  const p85 = percentile(sortedResults, 85)!;
  const p95 = percentile(sortedResults, 95)!;

  const minV = sortedResults[0];
  const maxV = sortedResults[sortedResults.length - 1];
  const buckets = Math.min(30, maxV - minV + 1) || 1;
  const step = (maxV - minV) / buckets || 1;

  const bins = Array.from({ length: buckets }, (_, i) => ({
    from: minV + i * step,
    to: minV + (i + 1) * step,
    count: 0,
    color: '',
  }));

  for (const v of sortedResults) {
    bins[Math.min(Math.floor((v - minV) / step), buckets - 1)].count++;
  }

  for (const b of bins) {
    const mid = (b.from + b.to) / 2;
    b.color = mid <= p50 ? '#3b82f6cc' : mid <= p85 ? '#f59e0bcc' : '#ef4444cc';
  }

  return { p50, p85, p95, histogram: bins };
}

export function buildMCSamplesFromWeeks(
  weeks: ThroughputWeek[],
  historyStartDate = MC_HISTORY_START_DATE,
): number[] {
  return weeks
    .filter((week) => week.date >= historyStartDate)
    .map((week) => week.count);
}

export function calculateEffectiveWip(params: {
  mode: QueueForecastMode;
  wipCount: number;
  downstreamP85: number | null;
  wipAging: WipAgingEntry[];
  wipResidualFactor?: number;
  agingFloor?: number;
}): number {
  const {
    mode,
    wipCount,
    downstreamP85,
    wipAging,
    wipResidualFactor = DEFAULT_WIP_RESIDUAL_FACTOR,
    agingFloor = DEFAULT_AGING_FLOOR,
  } = params;

  if (mode === 'conservative') return wipCount;
  if (mode === 'realistic') return wipCount * wipResidualFactor;

  const threshold = Math.max(1, downstreamP85 ?? 1);
  const residuals = wipAging.map((issue) => Math.max(agingFloor, 1 - (issue.age / threshold)));
  if (!residuals.length) return wipCount;

  const total = residuals.reduce((sum, value) => sum + value, 0);
  const averageResidual = total / residuals.length;

  return averageResidual * wipCount;
}

/**
 * Queue forecast: simulate when each item in a prioritized backlog will be completed.
 * effectiveWip = current WIP translated into an effective fractional queue position.
 * items = ordered list of backlog task names.
 * Returns a completion date forecast (P50/P85/P95) for each backlog item.
 */
export function runMCQueue(
  samples: number[],
  effectiveWip: number,
  items: string[],
  N = 10_000,
): QueueItemResult[] {
  const thresholds = items.map((_, idx) => effectiveWip + idx + 1);
  const weeksByItem: number[][] = Array.from({ length: items.length }, () => []);

  for (let i = 0; i < N; i++) {
    let weeks = 0;
    let done = 0;
    let nextTarget = 0;

    while (nextTarget < thresholds.length && weeks <= 520) {
      done += samples[Math.floor(Math.random() * samples.length)];
      weeks++;

      while (nextTarget < thresholds.length && done >= thresholds[nextTarget]) {
        weeksByItem[nextTarget].push(weeks);
        nextTarget++;
      }
    }
  }

  const today = new Date();
  const weeksToDate = (w: number): Date => {
    const d = new Date(today);
    d.setDate(d.getDate() + Math.round(w) * 7);
    return d;
  };

  return items.map((name, idx) => {
    const sorted = [...weeksByItem[idx]].sort((a, b) => a - b);
    return {
      name,
      p50: weeksToDate(percentile(sorted, 50)!),
      p85: weeksToDate(percentile(sorted, 85)!),
      p95: weeksToDate(percentile(sorted, 95)!),
    };
  });
}
