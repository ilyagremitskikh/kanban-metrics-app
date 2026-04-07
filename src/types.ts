export interface Transition {
  status: string;
  enteredAt: string;
}

export interface Issue {
  key: string;
  summary: string;
  type: string;
  created: string;
  currentStatus: string;
  transitions: Transition[];
  /** Jira status category key: "new" | "indeterminate" | "done" */
  statusCategory?: string;
  /** Jira resolution name, e.g. "Done", "Won't Fix", "Duplicate" */
  resolution?: string;
}

export interface TableRow {
  key: string;
  summary: string;
  type: string;
  currentStatus: string;
  created: string;
  leadTime: number | null;
  cycleTime: number | null;
  completedAt: Date | null;
}

export interface ThroughputWeek {
  date: string;
  count: number;
}

export type JQLMode = 'standard' | 'custom';
export type MCMode = 'items' | 'date' | 'queue';
export type SortDir = 'asc' | 'desc';
export type SortCol = keyof TableRow;

export interface SortState {
  col: SortCol;
  dir: SortDir;
}

export interface MetricConfig {
  ltStart: string;
  ltEnd: string;
  ctStart: string;
  ctEnd: string;
}

export interface WorkflowConfig {
  types: string[];
  statuses: string[];
  ltStart: string;
  ltEnd: string;
  ctStart: string;
  ctEnd: string;
}

export interface Settings {
  webhookUrl: string;
  aiWebhookUrl?: string; // Добавлено для ИИ
  dateFrom: string;
  dateTo: string;
  mode: JQLMode;
  projectKey: string;
  issueTypes: string[];
  extraConditions: string;
  customJql: string;
}

export interface RiceIssue {
  key: string;
  summary: string;
  issue_type: string;
  labels: string;
  priority: string;
  status: string;
  // RICE fields (User Story / Задача)
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  rice_score: number | null;
  // Bug fields (Ошибка)
  severity: string | null;
  bug_priority: string | null;
  bug_score: number | null;
  // Tech Debt fields (Техдолг)
  cost_of_delay: number | null;
}

export interface CalculatedMetrics {
  ltValues: number[];
  ctValues: number[];
  tpWeeks: ThroughputWeek[];
  wipNow: number;
  tableData: TableRow[];
}

export type AIAction = 'calc_wip' | 'find_bottlenecks';

export interface AIWipPayload {
  action: 'calc_wip';
  data: {
    throughputWeekly: number;
    cycleTimeP50: number;
    currentSystemWip: number;
    averageTimeInStatus: Record<string, number>;
  };
}

export interface AIBottlenecksPayload {
  action: 'find_bottlenecks';
  data: {
    historicalTiS: Record<string, { p50: number; p85: number }>;
    currentQueues: Record<string, number>;
    agingIssues: { key: string; status: string; timeInStatus: number; summary: string }[];
  };
}

export interface AIWipResponse {
  globalLimit: number;
  limits: Record<string, number>;
  advice: string;
}

export interface AIBottlenecksResponse {
  bottlenecks: string[];
  agingAlerts: string[];
  advice: string;
}

export interface AICache<T> {
  timestamp: number;
  data: T;
}
