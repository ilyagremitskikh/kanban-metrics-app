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

function buildMinimalJiraIssue(patch: TaskMutationPatch, existing?: JiraIssueShort): JiraIssueShort {
  const base = existing ?? {
    key: patch.key,
    summary: '',
    status: '',
    priority: '',
    issuetype: '',
    labels: [],
  };

  return mergeDefined(base, {
    key: patch.key,
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
  const base = existing ?? {
    key: patch.key,
    summary: '',
    issue_type: '',
    labels: '',
    priority: '',
    status: '',
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
    key: patch.key,
    summary: patch.summary,
    issue_type: patch.issuetype,
    labels: patch.labels ? patch.labels.join(', ') : undefined,
    priority: patch.priority,
    status: patch.status,
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
  const index = issues.findIndex((issue) => issue.key === patch.key);
  if (index === -1) {
    return [buildMinimalJiraIssue(patch), ...issues];
  }

  const next = [...issues];
  next[index] = buildMinimalJiraIssue(patch, next[index]);
  return next;
}

export function upsertRiceIssueList(issues: RiceIssue[], patch: TaskMutationPatch): RiceIssue[] {
  const index = issues.findIndex((issue) => issue.key === patch.key);
  if (index === -1) {
    return [buildRiceIssueFromTaskPatch(patch), ...issues];
  }

  const next = [...issues];
  next[index] = buildRiceIssueFromTaskPatch(patch, next[index]);
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
  return getRecord<PersistedTasksSnapshot>(TASKS_STORE, baseUrlKey);
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
