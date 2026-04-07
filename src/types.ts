export interface Transition {
  to: string;
  date: string;
  from?: string;
}

export interface Issue {
  key: string;
  summary: string;
  type: string;
  created: string;
  currentStatus: string;
  transitions: Transition[];
}

export interface TableRow {
  key: string;
  summary: string;
  type: string;
  currentStatus: string;
  created: string;
  leadTime: number | null;
  devCycleTime: number | null;
  upstreamTime: number | null;
  completedAt: Date | null;
}

export interface ThroughputWeek {
  date: string;
  count: number;
  byType?: Record<string, number>;
}

export interface ThroughputIssueRaw {
  key: string;
  issueType: string;
  resolution: string | null;
  resolutionDate: string | null;
}

export type JQLMode = 'standard' | 'custom';
export type MCMode = 'items' | 'date' | 'queue';
export type SortDir = 'asc' | 'desc';
export type SortCol = keyof TableRow;

export interface SortState {
  col: SortCol;
  dir: SortDir;
}

export interface Settings {
  webhookUrl: string;
  throughputWebhookUrl?: string;
  mode: JQLMode;
  projectKey: string;
  issueTypes: string[];
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
  severity: string | null;
  bug_priority: string | null;
  bug_score: number | null;
  cost_of_delay: number | null;
}
