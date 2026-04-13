import { describe, it, expect } from 'vitest';
import {
  calculateIssueMetrics,
  buildTableRows,
  buildThroughputWeeks,
  buildThroughputWeeksFromRaw,
  getThroughputTotal,
  isWipIssue,
  isDownstreamWipIssue,
  getDownstreamWipNow,
  BUCKETS,
} from '../metrics';
import type { Issue } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(
  key: string,
  created: string,
  currentStatus: string,
  transitions: { to: string; date: string }[],
  extra?: Partial<Issue>,
): Issue {
  return { key, summary: key, type: 'Task', created, currentStatus, transitions, ...extra };
}

// ---------------------------------------------------------------------------
// calculateIssueMetrics — Lead Time
// ---------------------------------------------------------------------------

describe('calculateIssueMetrics — Lead Time', () => {
  it('LT = created → last "Готово" transition', () => {
    const issue = makeIssue(
      'CREDITS-9036',
      '2026-04-03T06:49:35.000Z',
      'Готово',
      [
        { to: 'Готово к анализу', date: '2026-04-03T06:50:26.000Z' },
        { to: 'Разработка',      date: '2026-04-03T06:52:34.000Z' },
        { to: 'Готово',          date: '2026-04-03T12:24:32.000Z' },
      ],
    );
    const m = calculateIssueMetrics(issue);
    expect(m.leadTime).not.toBeNull();
    expect(m.leadTime!).toBeGreaterThan(0.18);
    expect(m.leadTime!).toBeLessThan(0.35);
  });

  it('no "Готово" transition → LT null', () => {
    const issue = makeIssue('X', '2026-04-01T00:00:00.000Z', 'Готово', []);
    const m = calculateIssueMetrics(issue);
    expect(m.leadTime).toBeNull();
  });

  it('cancelled task → LT null', () => {
    const issue = makeIssue('X', '2026-04-01T00:00:00.000Z', 'Отменена', [
      { to: 'Разработка', date: '2026-04-02T00:00:00.000Z' },
    ]);
    const m = calculateIssueMetrics(issue);
    expect(m.leadTime).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateIssueMetrics — Dev Cycle Time
// ---------------------------------------------------------------------------

describe('calculateIssueMetrics — Dev Cycle Time', () => {
  it('Dev CT = first DOWNSTREAM → last "Готово"', () => {
    const issue = makeIssue(
      'CREDITS-9011',
      '2026-03-31T08:05:58.000Z',
      'Готово',
      [
        { to: 'Разработка',      date: '2026-03-31T09:52:17.000Z' },
        { to: 'Готова к Prod',   date: '2026-04-01T07:59:53.000Z' },
        { to: 'Готово',          date: '2026-04-01T11:13:26.000Z' },
      ],
    );
    const m = calculateIssueMetrics(issue);
    expect(m.devCycleTime).not.toBeNull();
    expect(m.devCycleTime!).toBeGreaterThan(0.80);
    expect(m.devCycleTime!).toBeLessThan(1.1);
  });

  it('Ping-Pong: returns to UPSTREAM mid-flight, but timer uses first DOWNSTREAM', () => {
    const issue = makeIssue(
      'PING-1',
      '2026-04-01T00:00:00.000Z',
      'Готово',
      [
        { to: 'Анализ',          date: '2026-04-01T08:00:00.000Z' },
        { to: 'Разработка',      date: '2026-04-02T08:00:00.000Z' }, // first DOWNSTREAM
        { to: 'Анализ',          date: '2026-04-03T08:00:00.000Z' }, // returned to UPSTREAM
        { to: 'Разработка',      date: '2026-04-04T08:00:00.000Z' },
        { to: 'Готово',          date: '2026-04-05T08:00:00.000Z' },
      ],
    );
    const m = calculateIssueMetrics(issue);
    // Dev CT should be from 2026-04-02 (first downstream) to 2026-04-05 = 3 days
    expect(m.devCycleTime).not.toBeNull();
    expect(m.devCycleTime!).toBeGreaterThan(2.9);
    expect(m.devCycleTime!).toBeLessThan(3.1);
  });

  it('no DOWNSTREAM transitions → Dev CT null', () => {
    const issue = makeIssue(
      'PURE-UPSTREAM',
      '2026-04-01T00:00:00.000Z',
      'Готово',
      [
        { to: 'Анализ',  date: '2026-04-02T08:00:00.000Z' },
        { to: 'Готово',  date: '2026-04-05T08:00:00.000Z' },
      ],
    );
    const m = calculateIssueMetrics(issue);
    expect(m.devCycleTime).toBeNull();
  });

  it('direct flight to "Готово" → Dev CT null', () => {
    const issue = makeIssue('FAST', '2026-04-01T00:00:00.000Z', 'Готово', [
      { to: 'Готово', date: '2026-04-01T12:00:00.000Z' },
    ]);
    const m = calculateIssueMetrics(issue);
    expect(m.devCycleTime).toBeNull();
    expect(m.leadTime).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateIssueMetrics — Upstream Time
// ---------------------------------------------------------------------------

describe('calculateIssueMetrics — Upstream Time', () => {
  it('Upstream Time = first UPSTREAM → first DOWNSTREAM', () => {
    const issue = makeIssue(
      'UP-1',
      '2026-04-01T00:00:00.000Z',
      'Готово',
      [
        { to: 'Анализ',          date: '2026-04-01T08:00:00.000Z' },
        { to: 'Разработка',      date: '2026-04-03T08:00:00.000Z' },
        { to: 'Готово',          date: '2026-04-05T08:00:00.000Z' },
      ],
    );
    const m = calculateIssueMetrics(issue);
    // 2 days from Анализ to Разработка
    expect(m.upstreamTime).not.toBeNull();
    expect(m.upstreamTime!).toBeGreaterThan(1.9);
    expect(m.upstreamTime!).toBeLessThan(2.1);
  });

  it('Infinite Discovery: no DOWNSTREAM → Upstream Time = UPSTREAM to "Готово"', () => {
    const issue = makeIssue(
      'PURE-UP',
      '2026-04-01T00:00:00.000Z',
      'Готово',
      [
        { to: 'Анализ',  date: '2026-04-02T00:00:00.000Z' },
        { to: 'Готово',  date: '2026-04-05T00:00:00.000Z' },
      ],
    );
    const m = calculateIssueMetrics(issue);
    expect(m.upstreamTime).not.toBeNull();
    expect(m.upstreamTime!).toBeGreaterThan(2.9);
    expect(m.upstreamTime!).toBeLessThan(3.1);
    expect(m.devCycleTime).toBeNull();
  });

  it('no UPSTREAM transitions → Upstream Time null', () => {
    const issue = makeIssue('DEV-ONLY', '2026-04-01T00:00:00.000Z', 'Готово', [
      { to: 'Разработка', date: '2026-04-02T00:00:00.000Z' },
      { to: 'Готово',     date: '2026-04-04T00:00:00.000Z' },
    ]);
    const m = calculateIssueMetrics(issue);
    expect(m.upstreamTime).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WIP Classification
// ---------------------------------------------------------------------------

describe('isWipIssue', () => {
  it('task in DOWNSTREAM_ACTIVE → is WIP', () => {
    const issue = makeIssue('WIP-1', '2026-04-01T08:00:00.000Z', 'Разработка', []);
    expect(isWipIssue(issue)).toBe(true);
  });

  it('task in UPSTREAM_ACTIVE → is WIP', () => {
    const issue = makeIssue('WIP-2', '2026-04-01T08:00:00.000Z', 'Анализ', []);
    expect(isWipIssue(issue)).toBe(true);
  });

  it('task in QUEUE → not WIP', () => {
    const issue = makeIssue('Q-1', '2026-04-01T08:00:00.000Z', 'Бэклог', []);
    expect(isWipIssue(issue)).toBe(false);
  });

  it('task in "Готово" → not WIP', () => {
    const issue = makeIssue('D-1', '2026-04-01T08:00:00.000Z', 'Готово', []);
    expect(isWipIssue(issue)).toBe(false);
  });

  it('task in "Отменена" → not WIP', () => {
    const issue = makeIssue('C-1', '2026-04-01T08:00:00.000Z', 'Отменена', []);
    expect(isWipIssue(issue)).toBe(false);
  });
});

describe('isDownstreamWipIssue', () => {
  it('task in DOWNSTREAM_ACTIVE → is downstream WIP', () => {
    const issue = makeIssue('DWIP-1', '2026-04-01T08:00:00.000Z', 'Разработка', []);
    expect(isDownstreamWipIssue(issue)).toBe(true);
  });

  it('task in UPSTREAM_ACTIVE → is not downstream WIP', () => {
    const issue = makeIssue('DWIP-2', '2026-04-01T08:00:00.000Z', 'Анализ', []);
    expect(isDownstreamWipIssue(issue)).toBe(false);
  });

  it('"Готово к разработке" is not downstream WIP', () => {
    const issue = makeIssue('DWIP-3', '2026-04-01T08:00:00.000Z', 'Готово к разработке', []);
    expect(isDownstreamWipIssue(issue)).toBe(false);
  });
});

describe('getDownstreamWipNow', () => {
  it('counts only downstream active issues', () => {
    const issues = [
      makeIssue('A', '2026-04-01T00:00:00.000Z', 'Разработка', []),
      makeIssue('B', '2026-04-01T00:00:00.000Z', 'Code review', []),
      makeIssue('C', '2026-04-01T00:00:00.000Z', 'Анализ', []),
      makeIssue('D', '2026-04-01T00:00:00.000Z', 'Готово к разработке', []),
    ];

    expect(getDownstreamWipNow(issues)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildThroughputWeeks — zero-week filling
// ---------------------------------------------------------------------------

describe('buildThroughputWeeks', () => {
  it('returns only one week when all completions are in the same week', () => {
    const issues = [
      makeIssue('A', '2026-03-28T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-03-30T10:00:00.000Z' },
      ]),
      makeIssue('B', '2026-03-28T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-04-01T10:00:00.000Z' },
      ]),
      makeIssue('C', '2026-03-28T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-04-03T10:00:00.000Z' },
      ]),
    ];
    const weeks = buildThroughputWeeks(issues);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].date).toBe('2026-03-30');
    expect(weeks[0].count).toBe(3);
  });

  it('fills zero-count weeks between first and last completion', () => {
    const issues = [
      makeIssue('A', '2026-03-01T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-03-02T10:00:00.000Z' },
      ]),
      makeIssue('B', '2026-03-01T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-03-23T10:00:00.000Z' },
      ]),
    ];
    const weeks = buildThroughputWeeks(issues);
    // 4 weeks: 2026-03-02, 03-09, 03-16, 03-23
    expect(weeks).toHaveLength(4);
    expect(weeks.map((week) => week.date)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
    ]);
    expect(weeks[0].count).toBe(1);
    expect(weeks[1].count).toBe(0);
    expect(weeks[2].count).toBe(0);
    expect(weeks[3].count).toBe(1);
  });

  it('excludes issues that are not in "Готово"', () => {
    const issues = [
      makeIssue('A', '2026-04-01T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-04-02T10:00:00.000Z' },
      ]),
      makeIssue('B', '2026-04-01T00:00:00.000Z', 'Отменена', [
        { to: 'Отменена', date: '2026-04-03T10:00:00.000Z' },
      ]),
    ];
    const weeks = buildThroughputWeeks(issues);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].count).toBe(1);
  });

  it('returns empty array when no completions', () => {
    const issues = [makeIssue('A', '2026-04-01T00:00:00.000Z', 'Разработка', [])];
    expect(buildThroughputWeeks(issues)).toHaveLength(0);
  });
});

describe('buildThroughputWeeksFromRaw', () => {
  it('uses local monday for +0500 resolution dates', () => {
    const weeks = buildThroughputWeeksFromRaw([
      {
        key: 'CREDITS-9056',
        issueType: 'Ошибка',
        resolution: 'Разрешен',
        resolutionDate: '2026-04-09T14:57:09.000+0500',
        assignee: 'demidenko',
      },
      {
        key: 'CREDITS-8771',
        issueType: 'Ошибка',
        resolution: 'Разрешен',
        resolutionDate: '2026-04-06T10:27:38.000+0500',
        assignee: 'demidenko',
      },
    ]);

    expect(weeks).toHaveLength(1);
    expect(weeks[0].date).toBe('2026-04-06');
    expect(weeks[0].count).toBe(2);
  });
});

describe('getThroughputTotal', () => {
  it('sums weekly throughput counts from the throughput dataset', () => {
    expect(getThroughputTotal([
      { date: '2026-03-30', count: 4 },
      { date: '2026-04-06', count: 4 },
    ])).toBe(8);
  });

  it('matches the fallback throughput history total', () => {
    const weeks = buildThroughputWeeks([
      makeIssue('A', '2026-04-01T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-04-02T10:00:00.000Z' },
      ]),
      makeIssue('B', '2026-04-01T00:00:00.000Z', 'Готово', [
        { to: 'Готово', date: '2026-04-09T10:00:00.000Z' },
      ]),
      makeIssue('C', '2026-04-01T00:00:00.000Z', 'Отменена', [
        { to: 'Отменена', date: '2026-04-10T10:00:00.000Z' },
      ]),
    ]);

    expect(weeks.map((week) => week.count)).toEqual([1, 1]);
    expect(getThroughputTotal(weeks)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildTableRows — field names match TableRow interface
// ---------------------------------------------------------------------------

describe('buildTableRows', () => {
  it('completed task has leadTime and devCycleTime non-null', () => {
    const issue = makeIssue(
      'CREDITS-9036',
      '2026-04-03T06:49:35.000Z',
      'Готово',
      [
        { to: 'Разработка', date: '2026-04-03T07:10:00.000Z' },
        { to: 'Готово',     date: '2026-04-03T12:24:32.000Z' },
      ],
    );
    const rows = buildTableRows([issue]);
    expect(rows[0].leadTime).not.toBeNull();
    expect(rows[0].devCycleTime).not.toBeNull();
  });

  it('BUCKETS covers expected statuses', () => {
    expect(BUCKETS.DOWNSTREAM_ACTIVE).toContain('Разработка');
    expect(BUCKETS.UPSTREAM_ACTIVE).toContain('Анализ');
    expect(BUCKETS.DONE_TERMINAL).toContain('Готово');
    expect(BUCKETS.QUEUE).toContain('Бэклог');
  });

  it('"Готово к разработке" is in QUEUE, not UPSTREAM_ACTIVE', () => {
    expect(BUCKETS.QUEUE).toContain('Готово к разработке');
    expect(BUCKETS.UPSTREAM_ACTIVE).not.toContain('Готово к разработке');
  });
});
