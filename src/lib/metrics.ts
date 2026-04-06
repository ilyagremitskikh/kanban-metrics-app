import type { Issue, TableRow, ThroughputWeek, WorkflowConfig } from '../types';
import { toMonday, isNonDoneTerminal } from './utils';

export function getWorkflowForIssue(
  issue: Issue,
  workflows: WorkflowConfig[],
): WorkflowConfig | null {
  return workflows.find((w) => w.types.includes(issue.type)) ?? null;
}

export function getStatusEntryTime(issue: Issue, status: string): Date | null {
  const matches = issue.transitions.filter((t) => t.status === status);
  if (!matches.length) return null;
  return new Date(Math.min(...matches.map((t) => new Date(t.enteredAt).getTime())));
}

/** Lead Time: first entry into startStatus (fallback: issue.created) → first entry into endStatus */
export function calcLeadTime(
  issue: Issue,
  startStatus: string,
  endStatus: string,
): number | null {
  const start = getStatusEntryTime(issue, startStatus) ?? new Date(issue.created);
  const end = getStatusEntryTime(issue, endStatus);
  if (!end || end <= start) return null;
  return (end.getTime() - start.getTime()) / 86400000;
}

/** Cycle Time: LAST entry into startStatus (before first endStatus) → first entry into endStatus.
 *  If endStatus is never reached, falls back to fallbackEndStatus (e.g. ltEnd) to handle
 *  fast-track transitions that skip ctEnd entirely (e.g. "Без тестирования в прод"). */
export function calcCycleTime(
  issue: Issue,
  startStatus: string,
  endStatus: string,
  fallbackEndStatus?: string,
): number | null {
  const resolvedEndStatus = issue.transitions.some((t) => t.status === endStatus)
    ? endStatus
    : fallbackEndStatus ?? null;
  if (!resolvedEndStatus) return null;

  const endMatches = issue.transitions.filter((t) => t.status === resolvedEndStatus);
  if (!endMatches.length) return null;
  const endTime = Math.min(...endMatches.map((t) => new Date(t.enteredAt).getTime()));

  let lastStart: Date | null = null;
  for (const t of issue.transitions) {
    if (t.status === startStatus) {
      const d = new Date(t.enteredAt);
      if (d.getTime() < endTime) {
        lastStart = d;
      }
    }
  }
  if (!lastStart || endTime <= lastStart.getTime()) return null;
  return (endTime - lastStart.getTime()) / 86400000;
}

export function buildTableRows(
  issues: Issue[],
  workflows: WorkflowConfig[],
): TableRow[] {
  return issues.map((issue) => {
    const wf = getWorkflowForIssue(issue, workflows);
    if (!wf) {
      return {
        key: issue.key,
        summary: issue.summary,
        type: issue.type,
        currentStatus: issue.currentStatus,
        created: issue.created,
        leadTime: null,
        cycleTime: null,
        completedAt: null,
      };
    }
    return {
      key: issue.key,
      summary: issue.summary,
      type: issue.type,
      currentStatus: issue.currentStatus,
      created: issue.created,
      leadTime: calcLeadTime(issue, wf.ltStart, wf.ltEnd),
      cycleTime: calcCycleTime(issue, wf.ctStart, wf.ctEnd, wf.ltEnd),
      completedAt: getStatusEntryTime(issue, wf.ltEnd),
    };
  });
}

/** Current WIP breakdown by status. */
export function getWipByStatus(
  issues: Issue[],
  workflows: WorkflowConfig[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    const wf = getWorkflowForIssue(issue, workflows);
    if (!wf || !isWipIssue(issue, wf)) continue;
    counts[issue.currentStatus] = (counts[issue.currentStatus] || 0) + 1;
  }
  return counts;
}

/** Resolutions that don't represent real delivered work */
const NON_DELIVERY_RESOLUTIONS = new Set(["Won't Fix", "Duplicate", "Невозможно воспроизвести", "Не является ошибкой"]);

export function buildThroughputWeeks(
  issues: Issue[],
  workflows: WorkflowConfig[],
): ThroughputWeek[] {
  const map = new Map<string, number>();
  for (const issue of issues) {
    const wf = getWorkflowForIssue(issue, workflows);
    if (!wf) continue;
    // Exclude non-delivery resolutions when resolution data is available
    if (issue.resolution && NON_DELIVERY_RESOLUTIONS.has(issue.resolution)) continue;
    const doneTs = issue.transitions
      .filter((t) => t.status === wf.ltEnd)
      .map((t) => new Date(t.enteredAt).getTime());
    if (!doneTs.length) continue;
    const key = toMonday(new Date(Math.min(...doneTs))).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  if (map.size === 0) return [];

  // Fill zero-count weeks between first and last completion so the average
  // and chart include idle weeks rather than only active ones.
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

export function buildThroughputWeeksWithZeros(
  issues: Issue[],
  workflows: WorkflowConfig[],
): number[] {
  const map = new Map<string, number>();
  for (const issue of issues) {
    const wf = getWorkflowForIssue(issue, workflows);
    if (!wf) continue;
    const doneTs = issue.transitions
      .filter((t) => t.status === wf.ltEnd)
      .map((t) => new Date(t.enteredAt).getTime());
    if (!doneTs.length) continue;
    const key = toMonday(new Date(Math.min(...doneTs))).toISOString().slice(0, 10);
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

/** True if `status` appears before ctStart in the workflow's status order (i.e. pre-work). */
function isPreWorkStatus(status: string, wf: WorkflowConfig): boolean {
  // If the status IS the ltStart, it's always pre-work
  if (status === wf.ltStart) return true;

  const curIdx = wf.statuses.indexOf(status);
  const ctIdx  = wf.statuses.indexOf(wf.ctStart);

  // Primary: both status and ctStart are in the ordered list
  if (ctIdx !== -1 && curIdx !== -1) return curIdx < ctIdx;

  // Fallback: status not in the ordered list (e.g. "Идея" absent from transitions).
  // Use ltStart as the boundary — anything at or before ltStart is pre-work.
  if (curIdx === -1) {
    const ltIdx = wf.statuses.indexOf(wf.ltStart);
    // If ltStart is also absent from the list, we can't determine order —
    // conservatively treat unknown statuses as NOT pre-work so they surface in WIP.
    if (ltIdx === -1) return false;
    // Status is not in the ordered list at all — it's likely a discovery-phase
    // status that never appeared in transitions. Treat as pre-work.
    return true;
  }

  // ctStart not in statuses — use ltStart as the boundary instead
  const ltIdx = wf.statuses.indexOf(wf.ltStart);
  if (ltIdx !== -1) return curIdx <= ltIdx;

  return false;
}

/** Shared WIP predicate — used by getWipNow and AgingWIP for consistency. */
export function isWipIssue(issue: Issue, wf: WorkflowConfig): boolean {
  return (
    issue.currentStatus !== wf.ltEnd &&
    !isNonDoneTerminal(issue) &&
    !isPreWorkStatus(issue.currentStatus, wf)
  );
}

export function getWipNow(
  issues: Issue[],
  workflows: WorkflowConfig[],
): number {
  return issues.filter((i) => {
    const wf = getWorkflowForIssue(i, workflows);
    return wf ? isWipIssue(i, wf) : false;
  }).length;
}
