import type { Settings } from '../types';

const STANDARD_ISSUE_TYPES = ['User Story', 'Задача', 'Ошибка', 'Техдолг', 'BUSINESS SUB-TASK', 'Подзадача'];
const DEFAULT_LABEL_FILTER = 'Партнерские_Интеграции';

function quote(value: string): string {
  return `"${value}"`;
}

export function buildStandardMetricsJql(projectKey: string): string {
  const normalizedProject = projectKey.trim() || 'CREDITS';
  const issueTypes = STANDARD_ISSUE_TYPES.map(quote).join(', ');

  return [
    `project = ${normalizedProject}`,
    `issuetype in (${issueTypes})`,
    `labels = ${DEFAULT_LABEL_FILTER}`,
    'ORDER BY created ASC',
  ].join(' AND ');
}

export function getStandardFilterDescription(): string {
  return 'Берём задачи проекта по фиксированному набору типов и лейблу Партнерские_Интеграции без жёсткого списка статусов.';
}

export function buildMetricsRequestBody(settings: Settings): { project?: string; customJql?: string } {
  if (settings.mode === 'custom') {
    return { customJql: settings.customJql.trim() };
  }

  return { project: settings.projectKey.trim() };
}
