function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeIssueKey(value: unknown): string | null {
  return asNonEmptyString(value);
}

export function requireIssueKey(value: unknown, message = 'Некорректный ключ задачи'): string {
  const key = normalizeIssueKey(value);
  if (!key) throw new Error(message);
  return key;
}

export function issueKeyRank(value: unknown): number {
  const key = normalizeIssueKey(value);
  if (!key) return -1;
  const match = key.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function compareIssueKeys(left: unknown, right: unknown, dir: 'asc' | 'desc' = 'asc'): number {
  const leftKey = normalizeIssueKey(left);
  const rightKey = normalizeIssueKey(right);

  if (leftKey && rightKey) {
    const result = leftKey.localeCompare(rightKey, 'ru', { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? result : -result;
  }

  if (leftKey && !rightKey) return -1;
  if (!leftKey && rightKey) return 1;
  return 0;
}
