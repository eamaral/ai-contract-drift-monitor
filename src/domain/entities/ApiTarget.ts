export interface ApiTarget {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ApiSnapshot {
  [key: string]: unknown;
}

export interface DriftCheckResult {
  hasChanges: boolean;
  targets: ApiTarget[];
  changes: Array<{
    targetId: string;
    diff: string;
  }>;
  summary?: string;
  timestamp: Date;
}
