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
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  rice_score: number | null;
}

export interface CalculatedMetrics {
  ltValues: number[];
  ctValues: number[];
  tpWeeks: ThroughputWeek[];
  wipNow: number;
  tableData: TableRow[];
}
