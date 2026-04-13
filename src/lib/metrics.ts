import type { Issue, TableRow, ThroughputWeek, ThroughputIssueRaw } from '../types';
import { toMonday } from './utils';

const MS_IN_DAY = 1000 * 60 * 60 * 24;

export const BUCKETS = {
  QUEUE: [
    'Идея', 'Бэклог', 'Готово к проработке', 'Готово к разработке',
  ],
  UPSTREAM_ACTIVE: [
    'Проработка идеи', 'Подготовка к исследованию', 'Проверка гипотезы',
    'Разработка прототипа', 'Оценка риска', 'Готово к анализу',
    'Анализ', 'План приемки', 'Ожидает плана приемки',
    'Подготовка тест-кейсов',
  ],
  DOWNSTREAM_ACTIVE: [
    'Разработка', 'Code review', 'Правки', 'Готово к тестированию',
    'Тестирование Stage', 'Регресс', 'Тест ОО', 'Готово к регрессу',
    'Готова к Prod', 'Приемка', 'Частичный релиз', 'Релиз', 'Ревью',
  ],
  DONE_TERMINAL: [
    'Готово', 'Отменена', 'Архив',
  ],
};

export const SUCCESS_DONE_STATUS = 'Готово';

interface IssueMetrics {
  isUpstreamWip: boolean;
  isDownstreamWip: boolean;
  leadTime: number | null;
  devCycleTime: number | null;
  upstreamTime: number | null;
  completedAt: Date | null;
}

export function calculateIssueMetrics(issue: Issue): IssueMetrics {
  const result: IssueMetrics = {
    isUpstreamWip: false,
    isDownstreamWip: false,
    leadTime: null,
    devCycleTime: null,
    upstreamTime: null,
    completedAt: null,
  };

  // 1. Snapshot Metrics (WIP)
  if (BUCKETS.UPSTREAM_ACTIVE.includes(issue.currentStatus)) {
    result.isUpstreamWip = true;
  }
  if (BUCKETS.DOWNSTREAM_ACTIVE.includes(issue.currentStatus)) {
    result.isDownstreamWip = true;
  }

  // 2. Time Metrics — only for successfully completed issues
  if (issue.currentStatus !== SUCCESS_DONE_STATUS) return result;

  const sorted = [...issue.transitions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Find last entry into "Готово"
  const doneTransitions = sorted.filter((t) => t.to === SUCCESS_DONE_STATUS);
  if (doneTransitions.length === 0) return result;

  const doneDtm = new Date(doneTransitions[doneTransitions.length - 1].date).getTime();
  const createdDtm = new Date(issue.created).getTime();

  result.completedAt = new Date(doneDtm);

  // A. Lead Time: from created to last entry into "Готово"
  result.leadTime = (doneDtm - createdDtm) / MS_IN_DAY;

  // B. Dev Cycle Time: from FIRST entry into DOWNSTREAM_ACTIVE to last "Готово"
  const firstDownstream = sorted.find((t) => BUCKETS.DOWNSTREAM_ACTIVE.includes(t.to));
  let devStartDtm: number | null = null;

  if (firstDownstream) {
    devStartDtm = new Date(firstDownstream.date).getTime();
    if (devStartDtm < doneDtm) {
      result.devCycleTime = (doneDtm - devStartDtm) / MS_IN_DAY;
    }
  }

  // C. Upstream Time: from FIRST entry into UPSTREAM_ACTIVE to FIRST entry into DOWNSTREAM (or "Готово")
  const firstUpstream = sorted.find((t) => BUCKETS.UPSTREAM_ACTIVE.includes(t.to));

  if (firstUpstream) {
    const upStartDtm = new Date(firstUpstream.date).getTime();
    const upEndDtm = devStartDtm !== null ? devStartDtm : doneDtm;

    if (upStartDtm < upEndDtm) {
      result.upstreamTime = (upEndDtm - upStartDtm) / MS_IN_DAY;
    }
  }

  return result;
}

/** True if issue is currently in WIP (upstream or downstream). */
export function isWipIssue(issue: Issue): boolean {
  return (
    BUCKETS.UPSTREAM_ACTIVE.includes(issue.currentStatus) ||
    BUCKETS.DOWNSTREAM_ACTIVE.includes(issue.currentStatus)
  );
}

/** True if issue is currently in downstream delivery WIP. */
export function isDownstreamWipIssue(issue: Issue): boolean {
  return BUCKETS.DOWNSTREAM_ACTIVE.includes(issue.currentStatus);
}

export function buildTableRows(issues: Issue[]): TableRow[] {
  return issues.map((issue) => {
    const m = calculateIssueMetrics(issue);
    return {
      key: issue.key,
      summary: issue.summary,
      type: issue.type,
      currentStatus: issue.currentStatus,
      created: issue.created,
      leadTime: m.leadTime,
      devCycleTime: m.devCycleTime,
      upstreamTime: m.upstreamTime,
      completedAt: m.completedAt,
    };
  });
}

export function getWipNow(issues: Issue[]): number {
  return issues.filter(isWipIssue).length;
}

export function getDownstreamWipNow(issues: Issue[]): number {
  return issues.filter(isDownstreamWipIssue).length;
}

export function getIssueAgeInActiveBucket(issue: Issue, bucket: 'upstream' | 'downstream', now = new Date()): number {
  const activeBucketStatuses = bucket === 'upstream'
    ? BUCKETS.UPSTREAM_ACTIVE
    : BUCKETS.DOWNSTREAM_ACTIVE;

  const sorted = [...issue.transitions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const firstBucketTransition = sorted.find((t) => activeBucketStatuses.includes(t.to));
  const startTs = firstBucketTransition
    ? new Date(firstBucketTransition.date).getTime()
    : new Date(issue.created).getTime();

  return (now.getTime() - startTs) / MS_IN_DAY;
}

/** WIP breakdown by status, split into upstream and downstream buckets. */
export function getWipBuckets(issues: Issue[]): {
  upstream: Record<string, number>;
  downstream: Record<string, number>;
} {
  const upstream: Record<string, number> = {};
  const downstream: Record<string, number> = {};

  for (const issue of issues) {
    if (BUCKETS.UPSTREAM_ACTIVE.includes(issue.currentStatus)) {
      upstream[issue.currentStatus] = (upstream[issue.currentStatus] || 0) + 1;
    } else if (BUCKETS.DOWNSTREAM_ACTIVE.includes(issue.currentStatus)) {
      downstream[issue.currentStatus] = (downstream[issue.currentStatus] || 0) + 1;
    }
  }

  return { upstream, downstream };
}

export function buildThroughputWeeks(issues: Issue[]): ThroughputWeek[] {
  const map = new Map<string, number>();
  for (const issue of issues) {
    if (issue.currentStatus !== SUCCESS_DONE_STATUS) continue;
    const sorted = [...issue.transitions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const doneTransitions = sorted.filter((t) => t.to === SUCCESS_DONE_STATUS);
    if (!doneTransitions.length) continue;
    const doneDtm = new Date(doneTransitions[doneTransitions.length - 1].date).getTime();
    const key = toMonday(new Date(doneDtm)).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  if (map.size === 0) return [];

  const keys = [...map.keys()].sort();
  const result: ThroughputWeek[] = [];
  const cur = new Date(keys[0]);
  const last = new Date(keys[keys.length - 1]);
  while (cur <= last) {
    const k = cur.toISOString().slice(0, 10);
    result.push({ date: k, count: map.get(k) ?? 0 });
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

export function buildThroughputWeeksFromRaw(
  items: ThroughputIssueRaw[],
): ThroughputWeek[] {
  const weekMap = new Map<
    string,
    { total: number; byType: Record<string, number>; byAssignee: Record<string, number> }
  >();
  for (const item of items) {
    const rd = item.resolutionDate;
    if (!rd) continue;
    const typeName = item.issueType?.trim() ? item.issueType.trim() : 'Неизвестный тип';
    const assigneeName = item.assignee?.trim() ? item.assignee.trim() : 'Не назначен';
    const monday = toMonday(new Date(rd)).toISOString().slice(0, 10);
    if (!weekMap.has(monday)) weekMap.set(monday, { total: 0, byType: {}, byAssignee: {} });
    const entry = weekMap.get(monday)!;
    entry.total += 1;
    entry.byType[typeName] = (entry.byType[typeName] ?? 0) + 1;
    entry.byAssignee[assigneeName] = (entry.byAssignee[assigneeName] ?? 0) + 1;
  }
  if (weekMap.size === 0) return [];
  const keys = [...weekMap.keys()].sort();
  const result: ThroughputWeek[] = [];
  const cur = new Date(keys[0]);
  const last = new Date(keys[keys.length - 1]);
  while (cur <= last) {
    const k = cur.toISOString().slice(0, 10);
    const entry = weekMap.get(k);
    result.push({
      date: k,
      count: entry?.total ?? 0,
      byType: entry?.byType ?? {},
      byAssignee: entry?.byAssignee ?? {},
    });
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

export function buildThroughputWeeksWithZeros(issues: Issue[]): number[] {
  const map = new Map<string, number>();
  for (const issue of issues) {
    if (issue.currentStatus !== SUCCESS_DONE_STATUS) continue;
    const sorted = [...issue.transitions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const doneTransitions = sorted.filter((t) => t.to === SUCCESS_DONE_STATUS);
    if (!doneTransitions.length) continue;
    const doneDtm = new Date(doneTransitions[doneTransitions.length - 1].date).getTime();
    const key = toMonday(new Date(doneDtm)).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  if (map.size === 0) return [];

  const keys = [...map.keys()].sort();
  const firstMon = new Date(keys[0]);
  const lastMon = new Date(keys[keys.length - 1]);

  const result: number[] = [];
  const cur = new Date(firstMon);
  while (cur <= lastMon) {
    result.push(map.get(cur.toISOString().slice(0, 10)) || 0);
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

// ─── Predictability Score ─────────────────────────────────────────────────────

export interface PredictabilityPoint {
  date: string;   // ISO week date (Monday)
  score: number;  // 0–100
  cv: number;
  n: number;      // sample size
}

export interface PredictabilityResult {
  /** Current score 0–100 (based on last rollingWeeks window) */
  score: number;
  /** Standard deviation of CT in the current window */
  stdDev: number;
  /** Mean CT in the current window */
  meanCT: number;
  /** Raw CV = stdDev / mean */
  cv: number;
  /** % of issues that completed within their P85 SLE in the current window */
  sleHitRate: number;
  /** Rolling history for sparkline */
  history: PredictabilityPoint[];
  /** Sample size used for current score */
  n: number;
}

/**
 * Calculates the Predictability Score using a rolling window of Dev Cycle Time values.
 *
 * Formula: score = max(0, 100 - CV * 25)
 * where   CV = stdDev(CT) / mean(CT)
 */
export function calcPredictabilityHistory(
  rows: TableRow[],
  p85: number | null,
  rollingWeeks = 12,
): PredictabilityResult | null {
  const valid = rows
    .filter((r) => r.completedAt !== null && r.devCycleTime !== null)
    .map((r) => ({ completedAt: r.completedAt as Date, ct: r.devCycleTime as number }))
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  if (valid.length < 2) return null;

  const weekSet = new Set<string>();
  for (const { completedAt } of valid) {
    const mon = new Date(completedAt);
    mon.setDate(completedAt.getDate() - ((completedAt.getDay() + 6) % 7));
    mon.setHours(0, 0, 0, 0);
    weekSet.add(mon.toISOString().slice(0, 10));
  }
  const weeks = [...weekSet].sort();

  const windowMs = rollingWeeks * 7 * 24 * 60 * 60 * 1000;

  const history: PredictabilityPoint[] = [];
  for (const weekStr of weeks) {
    const windowEnd = new Date(weekStr);
    windowEnd.setDate(windowEnd.getDate() + 6);
    windowEnd.setHours(23, 59, 59, 999);
    const windowStart = new Date(windowEnd.getTime() - windowMs);

    const window = valid
      .filter((r) => r.completedAt >= windowStart && r.completedAt <= windowEnd)
      .map((r) => r.ct);

    if (window.length < 2) continue;

    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;
    const score = Math.max(0, Math.round(100 - cv * 25));

    history.push({ date: weekStr, score, cv: Math.round(cv * 100) / 100, n: window.length });
  }

  if (!history.length) return null;

  const last = history[history.length - 1];

  const nowEnd = new Date(valid[valid.length - 1].completedAt);
  const nowStart = new Date(nowEnd.getTime() - windowMs);
  const currentWindow = valid
    .filter((r) => r.completedAt >= nowStart && r.completedAt <= nowEnd)
    .map((r) => r.ct);

  const mean = currentWindow.reduce((s, v) => s + v, 0) / currentWindow.length;
  const variance = currentWindow.reduce((s, v) => s + (v - mean) ** 2, 0) / currentWindow.length;
  const stdDev = Math.sqrt(variance);

  const sleHitRate = p85 !== null
    ? Math.round((currentWindow.filter((ct) => ct <= p85).length / currentWindow.length) * 100)
    : 0;

  return {
    score: last.score,
    stdDev: Math.round(stdDev * 10) / 10,
    meanCT: Math.round(mean * 10) / 10,
    cv: last.cv,
    sleHitRate,
    history,
    n: last.n,
  };
}
