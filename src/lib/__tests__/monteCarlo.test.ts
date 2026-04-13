import { describe, expect, it } from 'vitest';
import {
  MC_HISTORY_START_DATE,
  buildMCSamplesFromWeeks,
  calculateEffectiveWip,
  runMCQueue,
} from '../monteCarlo';
import type { ThroughputWeek } from '../../types';

describe('buildMCSamplesFromWeeks', () => {
  it('filters out weeks before the configured Monte Carlo history start date', () => {
    const weeks: ThroughputWeek[] = [
      { date: '2026-01-05', count: 9 },
      { date: MC_HISTORY_START_DATE, count: 4 },
      { date: '2026-01-19', count: 6 },
    ];

    expect(buildMCSamplesFromWeeks(weeks)).toEqual([4, 6]);
  });
});

describe('calculateEffectiveWip', () => {
  it('calculates effective WIP for all queue modes', () => {
    const common = {
      wipCount: 5,
      downstreamP85: 10,
      wipAging: [{ age: 2 }, { age: 4 }, { age: 12 }],
    };

    expect(calculateEffectiveWip({ mode: 'conservative', ...common })).toBe(5);
    expect(calculateEffectiveWip({ mode: 'realistic', ...common })).toBe(3);

    const agingAware = calculateEffectiveWip({ mode: 'agingAware', ...common });
    expect(agingAware).toBeCloseTo(2.75, 3);
  });

  it('age-aware mode respects the lower residual floor and never goes to zero', () => {
    const effective = calculateEffectiveWip({
      mode: 'agingAware',
      wipCount: 4,
      downstreamP85: 5,
      wipAging: [{ age: 100 }],
    });

    expect(effective).toBe(1);
  });

  it('does not change when upstream tasks are excluded from downstream WIP input', () => {
    const downstreamOnly = calculateEffectiveWip({
      mode: 'agingAware',
      wipCount: 2,
      downstreamP85: 10,
      wipAging: [{ age: 2 }, { age: 6 }],
    });
    const sameDownstreamWithoutUpstreamNoise = calculateEffectiveWip({
      mode: 'agingAware',
      wipCount: 2,
      downstreamP85: 10,
      wipAging: [{ age: 2 }, { age: 6 }],
    });

    expect(sameDownstreamWithoutUpstreamNoise).toBeCloseTo(downstreamOnly, 6);
  });
});

describe('runMCQueue', () => {
  it('supports fractional effective WIP when shifting backlog positions', () => {
    const results = runMCQueue([1], 1.5, ['Task 1', 'Task 2'], 100);

    expect(results[0].p50.getTime()).toBe(results[0].p85.getTime());
    expect(results[0].p85.getTime()).toBe(results[0].p95.getTime());
    expect(results[1].p50.getTime()).toBe(results[1].p85.getTime());

    const weekMs = 7 * 86_400_000;
    expect((results[0].p50.getTime() - Date.now()) / weekMs).toBeGreaterThanOrEqual(2.5);
    expect((results[1].p50.getTime() - results[0].p50.getTime()) / weekMs).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps percentile ordering for each queue item', () => {
    const results = runMCQueue([0, 1, 2, 3], 2.4, ['Task 1', 'Task 2'], 500);

    for (const result of results) {
      expect(result.p50.getTime()).toBeLessThanOrEqual(result.p85.getTime());
      expect(result.p85.getTime()).toBeLessThanOrEqual(result.p95.getTime());
    }
  });
});
