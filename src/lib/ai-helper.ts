import type { Issue, CalculatedMetrics, WorkflowConfig, AIWipPayload, AIBottlenecksPayload } from '../types';
import { getWorkflowForIssue, isWipIssue } from './metrics';
import { percentile } from './utils';

export function prepareWipPayload(
  issues: Issue[],
  metrics: CalculatedMetrics,
  workflows: WorkflowConfig[]
): AIWipPayload {
  const statusDurations: Record<string, number[]> = {};

  for (const issue of issues) {
    const wf = getWorkflowForIssue(issue, workflows);
    if (!wf) continue;
    
    const sorted = [...issue.transitions].sort(
      (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const durationDay =
        (new Date(sorted[i + 1].enteredAt).getTime() - new Date(sorted[i].enteredAt).getTime()) /
        86400000;
      const status = sorted[i].status;
      if (!statusDurations[status]) statusDurations[status] = [];
      statusDurations[status].push(durationDay);
    }
  }

  const averageTimeInStatus: Record<string, number> = {};
  for (const [status, durations] of Object.entries(statusDurations)) {
    const p50 = Math.round((percentile(durations, 50) || 0) * 10) / 10;
    if (p50 > 0) averageTimeInStatus[status] = p50;
  }

  const tpWeeks = metrics.tpWeeks.map((w) => w.count);
  const throughputWeekly = tpWeeks.length
    ? tpWeeks.reduce((a, b) => a + b, 0) / tpWeeks.length
    : 0;
  const cycleTimeP50 = percentile(metrics.ctValues, 50) || 0;

  return {
    action: 'calc_wip',
    data: {
      throughputWeekly: Math.round(throughputWeekly * 10) / 10,
      cycleTimeP50: Math.round(cycleTimeP50 * 10) / 10,
      currentSystemWip: metrics.wipNow,
      averageTimeInStatus,
    },
  };
}

export function prepareBottlenecksPayload(
  issues: Issue[],
  workflows: WorkflowConfig[]
): AIBottlenecksPayload {
  const statusDurations: Record<string, number[]> = {};
  const currentQueues: Record<string, number> = {};
  const agingIssues: AIBottlenecksPayload['data']['agingIssues'] = [];

  for (const issue of issues) {
    const wf = getWorkflowForIssue(issue, workflows);
    if (!wf) continue;

    const sorted = [...issue.transitions].sort(
      (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const durationDay =
        (new Date(sorted[i + 1].enteredAt).getTime() - new Date(sorted[i].enteredAt).getTime()) /
        86400000;
      const status = sorted[i].status;
      if (!statusDurations[status]) statusDurations[status] = [];
      statusDurations[status].push(durationDay);
    }

    if (isWipIssue(issue, wf)) {
      currentQueues[issue.currentStatus] = (currentQueues[issue.currentStatus] || 0) + 1;

      const currentStatusEntry = sorted[sorted.length - 1];
      if (currentStatusEntry) {
        const timeInStatus =
          (Date.now() - new Date(currentStatusEntry.enteredAt).getTime()) / 86400000;
        agingIssues.push({
          key: issue.key,
          summary: issue.summary,
          status: issue.currentStatus,
          timeInStatus: Math.round(timeInStatus * 10) / 10,
        });
      }
    }
  }

  const historicalTiS: Record<string, { p50: number; p85: number }> = {};
  for (const [status, durations] of Object.entries(statusDurations)) {
    historicalTiS[status] = {
      p50: Math.round((percentile(durations, 50) || 0) * 10) / 10,
      p85: Math.round((percentile(durations, 85) || 0) * 10) / 10,
    };
  }

  // Filter out issues that are not truly over P85 and at least 3 days stale.
  const filteredAging = agingIssues.filter((i) => {
    const stats = historicalTiS[i.status];
    if (!stats) return false;
    return i.timeInStatus > stats.p85 && i.timeInStatus > 3;
  });

  return {
    action: 'find_bottlenecks',
    data: {
      historicalTiS,
      currentQueues,
      agingIssues: filteredAging,
    },
  };
}
