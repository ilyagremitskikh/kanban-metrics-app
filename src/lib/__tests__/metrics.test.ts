import { describe, it, expect } from 'vitest';
import {
  calcLeadTime,
  calcCycleTime,
  buildTableRows,
  buildThroughputWeeks,
  isWipIssue,
} from '../metrics';
import type { Issue, WorkflowConfig } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(
  key: string,
  created: string,
  currentStatus: string,
  transitions: { status: string; enteredAt: string }[],
  extra?: Partial<Issue>,
): Issue {
  return { key, summary: key, type: 'Task', created, currentStatus, transitions, ...extra };
}

// ---------------------------------------------------------------------------
// Shared workflow configs matching the app defaults
// ---------------------------------------------------------------------------

const taskWorkflow: WorkflowConfig = {
  types: ['Task'],
  statuses: ['Бэклог', 'Анализ', 'Готово к разработке', 'Разработка', 'Code review', 'Готова к Prod', 'Готово'],
  ltStart: 'Бэклог',
  ltEnd: 'Готово',
  ctStart: 'Разработка',
  ctEnd: 'Готова к Prod',
};

const usWorkflow: WorkflowConfig = {
  types: ['User Story'],
  statuses: ['Идея', 'Бэклог', 'Готово к разработке', 'Разработка', 'Готово'],
  ltStart: 'Бэклог',
  ltEnd: 'Готово',
  ctStart: 'Разработка',
  ctEnd: 'Готово',
};

const workflows = [taskWorkflow, usWorkflow];

// ---------------------------------------------------------------------------
// Lead Time
// ---------------------------------------------------------------------------

describe('calcLeadTime', () => {
  it('CREDITS-9011: falls back to issue.created when no Бэклог transition', () => {
    const issue = makeIssue(
      'CREDITS-9011',
      '2026-03-31T08:05:58.000Z', // 13:05:58+05
      'Готово',
      [{ status: 'Готово', enteredAt: '2026-04-01T11:13:26.000Z' }], // 16:13:26+05
    );
    const lt = calcLeadTime(issue, taskWorkflow.ltStart, taskWorkflow.ltEnd);
    expect(lt).not.toBeNull();
    // ~1.13d (27h 7m 28s = 1.130 days)
    expect(lt!).toBeGreaterThan(1.0);
    expect(lt!).toBeLessThan(1.3);
  });

  it('CREDITS-9020: ~0.95d', () => {
    const issue = makeIssue(
      'CREDITS-9020',
      '2026-04-01T07:00:00.000Z', // 12:00:00+05
      'Готово',
      [{ status: 'Готово', enteredAt: '2026-04-02T05:48:30.000Z' }], // 10:48:30+05
    );
    const lt = calcLeadTime(issue, taskWorkflow.ltStart, taskWorkflow.ltEnd);
    expect(lt).not.toBeNull();
    expect(lt!).toBeGreaterThan(0.8);
    expect(lt!).toBeLessThan(1.1);
  });

  it('CREDITS-9030: no Готово → null', () => {
    const issue = makeIssue('CREDITS-9030', '2026-04-02T11:39:31.000Z', 'Бэклог', []);
    const lt = calcLeadTime(issue, taskWorkflow.ltStart, taskWorkflow.ltEnd);
    expect(lt).toBeNull();
  });

  it('CREDITS-9036: ~0.24d', () => {
    const issue = makeIssue(
      'CREDITS-9036',
      '2026-04-03T06:49:35.000Z', // 11:49:35+05
      'Готово',
      [{ status: 'Готово', enteredAt: '2026-04-03T12:24:32.000Z' }], // 17:24:32+05
    );
    const lt = calcLeadTime(issue, taskWorkflow.ltStart, taskWorkflow.ltEnd);
    expect(lt).not.toBeNull();
    expect(lt!).toBeGreaterThan(0.18);
    expect(lt!).toBeLessThan(0.35);
  });
});

// ---------------------------------------------------------------------------
// Cycle Time
// ---------------------------------------------------------------------------

describe('calcCycleTime', () => {
  it('CREDITS-9011: ~0.92d (normal path through Готова к Prod)', () => {
    const issue = makeIssue(
      'CREDITS-9011',
      '2026-03-31T08:05:58.000Z',
      'Готово',
      [
        { status: 'Разработка', enteredAt: '2026-03-31T09:52:17.000Z' }, // 14:52:17+05
        { status: 'Готова к Prod', enteredAt: '2026-04-01T07:59:53.000Z' }, // 12:59:53+05
        { status: 'Готово', enteredAt: '2026-04-01T11:13:26.000Z' },
      ],
    );
    const ct = calcCycleTime(issue, taskWorkflow.ctStart, taskWorkflow.ctEnd, taskWorkflow.ltEnd);
    expect(ct).not.toBeNull();
    expect(ct!).toBeGreaterThan(0.80);
    expect(ct!).toBeLessThan(1.05);
  });

  it('CREDITS-9020: ~0.20d', () => {
    const issue = makeIssue(
      'CREDITS-9020',
      '2026-04-01T07:00:00.000Z',
      'Готово',
      [
        { status: 'Разработка', enteredAt: '2026-04-01T12:35:17.000Z' }, // 17:35:17+05
        { status: 'Готова к Prod', enteredAt: '2026-04-01T17:25:46.000Z' }, // 22:25:46+05
        { status: 'Готово', enteredAt: '2026-04-02T05:48:30.000Z' },
      ],
    );
    const ct = calcCycleTime(issue, taskWorkflow.ctStart, taskWorkflow.ctEnd, taskWorkflow.ltEnd);
    expect(ct).not.toBeNull();
    expect(ct!).toBeGreaterThan(0.15);
    expect(ct!).toBeLessThan(0.27);
  });

  it('CREDITS-9030: no transitions → null', () => {
    const issue = makeIssue('CREDITS-9030', '2026-04-02T11:39:31.000Z', 'Бэклог', []);
    const ct = calcCycleTime(issue, taskWorkflow.ctStart, taskWorkflow.ctEnd, taskWorkflow.ltEnd);
    expect(ct).toBeNull();
  });

  it('CREDITS-9036 (BUG FIX): skips Готова к Prod, falls back to Готово → ~0.24d', () => {
    const issue = makeIssue(
      'CREDITS-9036',
      '2026-04-03T06:49:35.000Z',
      'Готово',
      [
        { status: 'Разработка', enteredAt: '2026-04-03T07:10:00.000Z' },
        // No Готова к Prod — went directly to Готово
        { status: 'Готово', enteredAt: '2026-04-03T12:24:32.000Z' },
      ],
    );
    const ct = calcCycleTime(issue, taskWorkflow.ctStart, taskWorkflow.ctEnd, taskWorkflow.ltEnd);
    expect(ct).not.toBeNull();
    // Without the fix this returned null; now it should be ~0.22d
    expect(ct!).toBeGreaterThan(0.15);
    expect(ct!).toBeLessThan(0.35);
  });

  it('without fallback, task skipping ctEnd returns null (regression guard)', () => {
    const issue = makeIssue(
      'CREDITS-9036',
      '2026-04-03T06:49:35.000Z',
      'Готово',
      [
        { status: 'Разработка', enteredAt: '2026-04-03T07:10:00.000Z' },
        { status: 'Готово', enteredAt: '2026-04-03T12:24:32.000Z' },
      ],
    );
    // No fallback provided — should return null
    const ct = calcCycleTime(issue, taskWorkflow.ctStart, taskWorkflow.ctEnd);
    expect(ct).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WIP Classification
// ---------------------------------------------------------------------------

describe('isWipIssue', () => {
  it('CREDITS-9011 (Готово) → not WIP', () => {
    const issue = makeIssue('CREDITS-9011', '2026-03-31T08:05:58.000Z', 'Готово', []);
    expect(isWipIssue(issue, taskWorkflow)).toBe(false);
  });

  it('CREDITS-9030 (Бэклог) → not WIP (pre-work)', () => {
    const issue = makeIssue('CREDITS-9030', '2026-04-02T11:39:31.000Z', 'Бэклог', []);
    expect(isWipIssue(issue, taskWorkflow)).toBe(false);
  });

  it('task in Разработка → is WIP', () => {
    const issue = makeIssue('WIP-1', '2026-04-01T08:00:00.000Z', 'Разработка', []);
    expect(isWipIssue(issue, taskWorkflow)).toBe(true);
  });

  it('task in Отменена → not WIP (non-done terminal)', () => {
    const issue = makeIssue('WIP-2', '2026-04-01T08:00:00.000Z', 'Отменена', []);
    expect(isWipIssue(issue, taskWorkflow)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Throughput — zero-week filling
// ---------------------------------------------------------------------------

describe('buildThroughputWeeks', () => {
  it('returns only one week when all completions are in the same week', () => {
    const issues = [
      makeIssue('A', '2026-03-28T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-03-30T10:00:00.000Z' },
      ]),
      makeIssue('B', '2026-03-28T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-04-01T10:00:00.000Z' },
      ]),
      makeIssue('C', '2026-03-28T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-04-03T10:00:00.000Z' },
      ]),
    ];
    const weeks = buildThroughputWeeks(issues, workflows);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].count).toBe(3);
  });

  it('fills zero-count weeks between first and last completion', () => {
    const issues = [
      makeIssue('A', '2026-03-01T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-03-02T10:00:00.000Z' }, // week of 2026-03-02
      ]),
      makeIssue('B', '2026-03-01T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-03-23T10:00:00.000Z' }, // week of 2026-03-23, 3 weeks later
      ]),
    ];
    const weeks = buildThroughputWeeks(issues, workflows);
    // Should have 4 weeks: 2026-03-02, 03-09, 03-16, 03-23
    expect(weeks).toHaveLength(4);
    expect(weeks[0].count).toBe(1);
    expect(weeks[1].count).toBe(0);
    expect(weeks[2].count).toBe(0);
    expect(weeks[3].count).toBe(1);
  });

  it('excludes issues with non-delivery resolution when resolution field is present', () => {
    const issues = [
      makeIssue('A', '2026-04-01T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-04-02T10:00:00.000Z' },
      ]),
      makeIssue('B', '2026-04-01T00:00:00.000Z', 'Готово', [
        { status: 'Готово', enteredAt: '2026-04-03T10:00:00.000Z' },
      ], { resolution: "Won't Fix" }),
    ];
    const weeks = buildThroughputWeeks(issues, workflows);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].count).toBe(1); // B excluded
  });

  it('returns empty array when no completions', () => {
    const issues = [makeIssue('A', '2026-04-01T00:00:00.000Z', 'Разработка', [])];
    expect(buildThroughputWeeks(issues, workflows)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildTableRows — CT count matches LT count for completed tasks
// ---------------------------------------------------------------------------

describe('buildTableRows CT count == LT count for completed tasks', () => {
  it('completed task that skips ctEnd has both LT and CT non-null', () => {
    const issue = makeIssue(
      'CREDITS-9036',
      '2026-04-03T06:49:35.000Z',
      'Готово',
      [
        { status: 'Разработка', enteredAt: '2026-04-03T07:10:00.000Z' },
        { status: 'Готово', enteredAt: '2026-04-03T12:24:32.000Z' },
      ],
    );
    const rows = buildTableRows([issue], workflows);
    expect(rows[0].leadTime).not.toBeNull();
    expect(rows[0].cycleTime).not.toBeNull();
  });
});
