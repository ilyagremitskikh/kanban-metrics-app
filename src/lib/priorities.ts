const PRIORITY_ALIASES: Record<string, string> = {
  highest: 'Неотложный',
  high: 'Высокий',
  medium: 'Нормальный',
  low: 'Низкий',
  lowest: 'Незначительный',
  неотложный: 'Неотложный',
  срочный: 'Срочный',
  высокий: 'Высокий',
  нормальный: 'Нормальный',
  низкий: 'Низкий',
  незначительный: 'Незначительный',
  средний: 'Средний',
  критический: 'Неотложный',
  blocker: 'Неотложный',
  critical: 'Срочный',
  major: 'Высокий',
  minor: 'Низкий',
  trivial: 'Незначительный',
};

export function normalizePriority(value: string | null | undefined): string {
  if (!value) return 'Нормальный';
  const normalized = PRIORITY_ALIASES[value.toLowerCase()];
  return normalized ?? 'Нормальный';
}
