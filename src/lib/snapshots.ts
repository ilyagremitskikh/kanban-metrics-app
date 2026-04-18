import type {
  Issue,
  JiraIssueShort,
  PersistedMeta,
  PersistedMetricsSnapshot,
  PersistedTasksSnapshot,
  ResourceSource,
  RiceIssue,
  Settings,
  SnapshotSchemaVersion,
  TaskMutationPatch,
  ThroughputWeek,
} from '../types';
import { normalizeJiraIssue, normalizeRiceIssue } from './apiNormalizers';
import { normalizeIssueKey, requireIssueKey } from './issueKeys';

const DB_NAME = 'kanban-metrics-app';
const DB_VERSION = 1;
const METRICS_STORE = 'metricsSnapshots';
const TASKS_STORE = 'tasksSnapshots';
const SCHEMA_VERSION: SnapshotSchemaVersion = 1;

type StoreName = typeof METRICS_STORE | typeof TASKS_STORE;

interface PersistedRecord<T> {
  key: string;
  value: T;
}

interface SanitizedSnapshotResult {
  snapshot: PersistedTasksSnapshot;
  changed: boolean;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function normalizeQueryPart(value: string): string {
  return value.trim();
}

export function buildMetricsSnapshotKey(settings: Settings): string {
  const baseUrl = normalizeBaseUrl(settings.n8nBaseUrl);
  if (settings.mode === 'custom') {
    return `${baseUrl}::custom::${normalizeQueryPart(settings.customJql)}`;
  }

  return `${baseUrl}::standard::${normalizeQueryPart(settings.projectKey)}`;
}

export function buildTasksSnapshotKey(n8nBaseUrl: string): string {
  return normalizeBaseUrl(n8nBaseUrl);
}

function createMeta({
  source,
  lastSyncAt,
  lastMutationAt = null,
}: {
  source: ResourceSource;
  lastSyncAt: string | null;
  lastMutationAt?: string | null;
}): PersistedMeta {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    lastSyncAt,
    lastMutationAt,
    source,
  };
}

function supportsIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!supportsIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(METRICS_STORE)) {
        db.createObjectStore(METRICS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        db.createObjectStore(TASKS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function getRecord<T>(storeName: StoreName, key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as PersistedRecord<T> | undefined;
      resolve(record?.value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`));
    tx.oncomplete = () => db.close();
  });
}

async function putRecord<T>(storeName: StoreName, key: string, value: T): Promise<void> {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put({ key, value } satisfies PersistedRecord<T>);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error(`Failed to write ${storeName}`));
  });
}

function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
  const next = { ...base };
  for (const [rawKey, value] of Object.entries(patch)) {
    if (value !== undefined) {
      Object.assign(next, { [rawKey]: value });
    }
  }
  return next;
}

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((label): label is string => typeof label === 'string');
}

function sanitizeJiraIssue(issue: JiraIssueShort): JiraIssueShort | null {
  const key = normalizeIssueKey(issue.key);
  if (!key) return null;

  const normalized = normalizeJiraIssue(issue as Parameters<typeof normalizeJiraIssue>[0]);
  const children = Array.isArray(normalized.children)
    ? normalized.children
      .map((child) => sanitizeJiraIssue(child))
      .filter((child): child is JiraIssueShort => child !== null)
    : undefined;

  return {
    ...normalized,
    key,
    summary: sanitizeString(normalized.summary),
    status: sanitizeString(normalized.status),
    priority: sanitizeString(normalized.priority),
    issuetype: sanitizeString(normalized.issuetype),
    description: typeof normalized.description === 'string' ? normalized.description : undefined,
    labels: sanitizeLabels(normalized.labels),
    parent_key: normalizeIssueKey(normalized.parent_key) ?? undefined,
    epic_key: normalizeIssueKey(normalized.epic_key) ?? undefined,
    children,
  };
}

function sanitizeRiceIssue(issue: RiceIssue): RiceIssue | null {
  const key = normalizeIssueKey(issue.key);
  if (!key) return null;

  const normalized = normalizeRiceIssue(issue as Parameters<typeof normalizeRiceIssue>[0]);
  return {
    ...normalized,
    key,
    summary: sanitizeString(normalized.summary),
    issue_type: sanitizeString(normalized.issue_type),
    labels: sanitizeString(normalized.labels),
    priority: sanitizeString(normalized.priority),
    status: sanitizeString(normalized.status),
    parent_key: normalizeIssueKey(normalized.parent_key) ?? undefined,
    epic_key: normalizeIssueKey(normalized.epic_key) ?? undefined,
  };
}

export function sanitizeTasksSnapshot(snapshot: PersistedTasksSnapshot): SanitizedSnapshotResult {
  const jiraIssues = snapshot.jiraIssues
    .map((issue) => sanitizeJiraIssue(issue))
    .filter((issue): issue is JiraIssueShort => issue !== null);
  const riceIssues = snapshot.riceIssues
    .map((issue) => sanitizeRiceIssue(issue))
    .filter((issue): issue is RiceIssue => issue !== null);

  const normalizedKey = buildTasksSnapshotKey(snapshot.key);
  const nextSnapshot: PersistedTasksSnapshot = {
    ...snapshot,
    key: normalizedKey,
    jiraIssues,
    riceIssues,
  };

  const changed = JSON.stringify(snapshot) !== JSON.stringify(nextSnapshot);
  return { snapshot: nextSnapshot, changed };
}

function ensureValidTaskPatch(patch: TaskMutationPatch): TaskMutationPatch & { key: string } {
  return {
    ...patch,
    key: requireIssueKey(patch.key, 'Некорректный ключ задачи в локальном обновлении'),
  };
}

function buildMinimalJiraIssue(patch: TaskMutationPatch, existing?: JiraIssueShort): JiraIssueShort {
  const key = requireIssueKey(patch.key, 'Некорректный ключ задачи в локальном обновлении');
  const base = existing ?? {
    key,
    summary: '',
    status: '',
    priority: '',
    issuetype: '',
    labels: [],
  };

  return mergeDefined(base, {
    key,
    summary: patch.summary,
    description: patch.description,
    status: patch.status,
    priority: patch.priority,
    issuetype: patch.issuetype,
    parent_key: patch.parent_key,
    epic_key: patch.epic_key,
    labels: patch.labels,
    created: patch.created,
    updated: patch.updated,
    reach: patch.reach,
    impact: patch.impact,
    confidence: patch.confidence,
    effort: patch.effort,
    rice_score: patch.rice_score,
    bug_risk: patch.bug_risk,
    bug_process: patch.bug_process,
    bug_scale: patch.bug_scale,
    bug_workaround: patch.bug_workaround,
    bug_score: patch.bug_score,
    td_impact: patch.td_impact,
    td_effort: patch.td_effort,
    td_roi: patch.td_roi,
  });
}

function buildRiceIssueFromTaskPatch(patch: TaskMutationPatch, existing?: RiceIssue): RiceIssue {
  const key = requireIssueKey(patch.key, 'Некорректный ключ задачи в локальном обновлении');
  const base = existing ?? {
    key,
    summary: '',
    issue_type: '',
    labels: '',
    priority: '',
    status: '',
    parent: undefined,
    parent_key: undefined,
    epic: undefined,
    epic_key: undefined,
    reach: null,
    impact: null,
    confidence: null,
    effort: null,
    rice_score: null,
    bug_risk: null,
    bug_process: null,
    bug_scale: null,
    bug_workaround: null,
    bug_score: null,
    td_impact: null,
    td_effort: null,
    td_roi: null,
  };

  return mergeDefined(base, {
    key,
    summary: patch.summary,
    issue_type: patch.issuetype,
    labels: patch.labels ? patch.labels.join(', ') : undefined,
    priority: patch.priority,
    status: patch.status,
    parent_key: patch.parent_key,
    epic_key: patch.epic_key,
    reach: patch.reach,
    impact: patch.impact,
    confidence: patch.confidence,
    effort: patch.effort,
    rice_score: patch.rice_score,
    bug_risk: patch.bug_risk,
    bug_process: patch.bug_process,
    bug_scale: patch.bug_scale,
    bug_workaround: patch.bug_workaround,
    bug_score: patch.bug_score,
    td_impact: patch.td_impact,
    td_effort: patch.td_effort,
    td_roi: patch.td_roi,
  });
}

export function upsertTaskList(issues: JiraIssueShort[], patch: TaskMutationPatch): JiraIssueShort[] {
  const nextPatch = ensureValidTaskPatch(patch);
  const index = issues.findIndex((issue) => issue.key === nextPatch.key);
  if (index === -1) {
    return [buildMinimalJiraIssue(nextPatch), ...issues];
  }

  const next = [...issues];
  next[index] = buildMinimalJiraIssue(nextPatch, next[index]);
  return next;
}

export function upsertRiceIssueList(issues: RiceIssue[], patch: TaskMutationPatch): RiceIssue[] {
  const nextPatch = ensureValidTaskPatch(patch);
  const index = issues.findIndex((issue) => issue.key === nextPatch.key);
  if (index === -1) {
    return [buildRiceIssueFromTaskPatch(nextPatch), ...issues];
  }

  const next = [...issues];
  next[index] = buildRiceIssueFromTaskPatch(nextPatch, next[index]);
  return next;
}

export function createMetricsSnapshot(
  key: string,
  issues: Issue[],
  throughputWeeks: ThroughputWeek[] | null,
  lastSyncAt: string | null,
): PersistedMetricsSnapshot {
  return {
    key,
    issues,
    throughputWeeks,
    meta: createMeta({ source: 'remote', lastSyncAt, lastMutationAt: null }),
  };
}

export function createTasksSnapshot(
  key: string,
  jiraIssues: JiraIssueShort[],
  riceIssues: RiceIssue[],
  lastSyncAt: string | null,
): PersistedTasksSnapshot {
  return {
    key,
    jiraIssues,
    riceIssues,
    meta: createMeta({ source: 'remote', lastSyncAt, lastMutationAt: null }),
  };
}

export function applyTaskPatchToSnapshot(
  snapshot: PersistedTasksSnapshot | null,
  key: string,
  patch: TaskMutationPatch,
): PersistedTasksSnapshot {
  const jiraIssues = upsertTaskList(snapshot?.jiraIssues ?? [], patch);
  const riceIssues = upsertRiceIssueList(snapshot?.riceIssues ?? [], patch);

  return {
    key,
    jiraIssues,
    riceIssues,
    meta: createMeta({
      source: 'local',
      lastSyncAt: snapshot?.meta.lastSyncAt ?? null,
      lastMutationAt: new Date().toISOString(),
    }),
  };
}

export function applyRicePatchToSnapshot(
  snapshot: PersistedTasksSnapshot | null,
  key: string,
  patch: TaskMutationPatch,
): PersistedTasksSnapshot {
  const jiraIssues = upsertTaskList(snapshot?.jiraIssues ?? [], patch);
  const riceIssues = upsertRiceIssueList(snapshot?.riceIssues ?? [], patch);

  return {
    key,
    jiraIssues,
    riceIssues,
    meta: createMeta({
      source: 'local',
      lastSyncAt: snapshot?.meta.lastSyncAt ?? null,
      lastMutationAt: new Date().toISOString(),
    }),
  };
}

export async function loadMetricsSnapshot(queryKey: string): Promise<PersistedMetricsSnapshot | null> {
  return getRecord<PersistedMetricsSnapshot>(METRICS_STORE, queryKey);
}

export async function saveMetricsSnapshot(queryKey: string, snapshot: PersistedMetricsSnapshot): Promise<void> {
  await putRecord(METRICS_STORE, queryKey, snapshot);
}

export async function loadTasksSnapshot(baseUrlKey: string): Promise<PersistedTasksSnapshot | null> {
  const snapshot = await getRecord<PersistedTasksSnapshot>(TASKS_STORE, baseUrlKey);
  if (!snapshot) return null;

  const { snapshot: sanitizedSnapshot, changed } = sanitizeTasksSnapshot(snapshot);
  if (changed) {
    await putRecord(TASKS_STORE, sanitizedSnapshot.key, sanitizedSnapshot);
  }

  return sanitizedSnapshot;
}

export async function saveTasksSnapshot(baseUrlKey: string, snapshot: PersistedTasksSnapshot): Promise<void> {
  await putRecord(TASKS_STORE, baseUrlKey, snapshot);
}

export async function upsertTaskInSnapshot(baseUrlKey: string, issuePatch: TaskMutationPatch): Promise<PersistedTasksSnapshot> {
  const current = await loadTasksSnapshot(baseUrlKey);
  const next = applyTaskPatchToSnapshot(current, baseUrlKey, issuePatch);
  await saveTasksSnapshot(baseUrlKey, next);
  return next;
}

export async function upsertRiceIssueInSnapshot(baseUrlKey: string, issuePatch: TaskMutationPatch): Promise<PersistedTasksSnapshot> {
  const current = await loadTasksSnapshot(baseUrlKey);
  const next = applyRicePatchToSnapshot(current, baseUrlKey, issuePatch);
  await saveTasksSnapshot(baseUrlKey, next);
  return next;
}
