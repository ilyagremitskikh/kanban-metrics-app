import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MC_HISTORY_START_DATE,
  buildMCSamplesFromWeeks,
  calculateEffectiveWip,
  runMCDate,
  runMCItems,
  runMCQueue,
} from '../monteCarlo';
import type { ThroughputWeek } from '../../types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mockSequentialRandomValues(count: number) {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = (i % count) / count;
    i += 1;
    return value;
  });
}

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

describe('runMCItems', () => {
  it('keeps higher confidence at later week counts', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    mockSequentialRandomValues(samples.length);

    const result = runMCItems(samples, 100, 100);

    expect(result.p50).toBeLessThanOrEqual(result.p85);
    expect(result.p85).toBeLessThanOrEqual(result.p95);
  });
});

describe('runMCDate', () => {
  it('maps higher confidence to lower completed-task counts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T00:00:00Z'));
    const samples = Array.from({ length: 100 }, (_, i) => i);
    mockSequentialRandomValues(samples.length);

    const result = runMCDate(samples, new Date('2026-04-23T00:00:00Z'), 100);

    expect(result.p95).toBeLessThanOrEqual(result.p85);
    expect(result.p85).toBeLessThanOrEqual(result.p50);
    expect(result.p50).toBeCloseTo(49.5);
    expect(result.p85).toBeCloseTo(14.85);
    expect(result.p95).toBeCloseTo(4.95);
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
