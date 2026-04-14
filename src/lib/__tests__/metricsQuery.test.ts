import { describe, expect, it } from 'vitest';

import { buildStandardMetricsJql, getStandardFilterDescription } from '../metricsQuery';

describe('buildStandardMetricsJql', () => {
  it('builds standard JQL without a hardcoded status list', () => {
    const jql = buildStandardMetricsJql('CREDITS');

    expect(jql).toContain('project = CREDITS');
    expect(jql).toContain('issuetype in ("User Story", "Задача", "Ошибка", "Техдолг", "BUSINESS SUB-TASK", "Подзадача")');
    expect(jql).toContain('labels = Партнерские_Интеграции');
    expect(jql).toContain('ORDER BY created ASC');
    expect(jql).not.toContain('status in (');
  });

  it('falls back to the default project key', () => {
    expect(buildStandardMetricsJql('   ')).toContain('project = CREDITS');
  });
});

describe('getStandardFilterDescription', () => {
  it('describes the filter without referring to a fixed status set', () => {
    expect(getStandardFilterDescription()).not.toContain('базовым статусам');
  });
});
