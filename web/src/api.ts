const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Types
export interface MemoryInfo {
  memoryId: string;
  memoryName: string;
  memoryFile: string;
  createdAt: string;
  lastSeen?: string;
  entries: number;
  size: number;
  tags: string[];
}

export interface MemoryEntry {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
  tags?: string[];
  updatedAt: string;
}

export interface MemoryStats {
  memoryId: string;
  memoryName?: string;
  entries: number;
  size: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  tags: string[];
  lastSeen: string | null;
  createdAt: string;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  memoryId: string;
  entryCount: number;
}

export interface SystemInfo {
  version: string;
  memlinkDir: string;
  serverHost: string;
  serverPort: number;
  memories: MemoryInfo[];
  totalMemories: number;
  totalEntries: number;
  totalSize: number;
}

// API functions
export const api = {
  info: () => request<SystemInfo>('/info'),

  listMemories: () => request<MemoryInfo[]>('/memories'),
  createMemory: (name: string) =>
    request<{ memoryId: string; memoryName: string }>('/memories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  getMemory: (id: string) =>
    request<MemoryInfo & MemoryStats>(`/memories/${encodeURIComponent(id)}`),
  deleteMemory: (id: string) =>
    request<{ ok: boolean }>(`/memories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getEntries: (id: string) => request<MemoryEntry[]>(`/memories/${encodeURIComponent(id)}/entries`),
  getEntry: (id: string, title: string) =>
    request<MemoryEntry>(
      `/memories/${encodeURIComponent(id)}/entries/${encodeURIComponent(title)}`
    ),
  upsertEntry: (id: string, title: string, content: string, tags?: string[]) =>
    request<MemoryEntry>(`/memories/${encodeURIComponent(id)}/entries`, {
      method: 'POST',
      body: JSON.stringify({ title, content, tags }),
    }),
  deleteEntry: (id: string, title: string) =>
    request<{ ok: boolean }>(
      `/memories/${encodeURIComponent(id)}/entries/${encodeURIComponent(title)}`,
      { method: 'DELETE' }
    ),

  search: (id: string, q: string) =>
    request<{ results: MemoryEntry[]; count: number }>(
      `/memories/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`
    ),

  getStats: (id: string) => request<MemoryStats>(`/memories/${encodeURIComponent(id)}/stats`),
  sync: (id: string) =>
    request<{ entries: number; size: number }>(`/memories/${encodeURIComponent(id)}/sync`, {
      method: 'POST',
    }),

  exportMemory: (id: string) =>
    request<{ exported: string[]; formatsDir: string; formats: string[] }>(
      `/memories/${encodeURIComponent(id)}/export`,
      { method: 'POST' }
    ),
  getMarkdown: (id: string) =>
    request<{ markdown: string }>(`/memories/${encodeURIComponent(id)}/markdown`),

  listBackups: (id: string) => request<BackupInfo[]>(`/memories/${encodeURIComponent(id)}/backups`),
  createBackup: (id: string) =>
    request<{ path: string }>(`/memories/${encodeURIComponent(id)}/backups`, { method: 'POST' }),
  restoreBackup: (id: string, backup_path: string, overwrite?: boolean) =>
    request<{ restored: number }>(`/memories/${encodeURIComponent(id)}/backups/restore`, {
      method: 'POST',
      body: JSON.stringify({ backup_path, overwrite }),
    }),
  cleanupBackups: (id: string, keep_count?: number) =>
    request<{ deleted: number; kept: number }>(
      `/memories/${encodeURIComponent(id)}/backups/cleanup`,
      { method: 'POST', body: JSON.stringify({ keep_count }) }
    ),
  deleteBackup: (path: string) =>
    request<{ ok: boolean }>('/backups', { method: 'DELETE', body: JSON.stringify({ path }) }),

  bulkDelete: (id: string, method: string, value: string, use_regex?: boolean, dry_run?: boolean) =>
    request<{
      deleted?: number;
      notFound?: string[];
      dryRun?: boolean;
      count?: number;
      entries?: string[];
    }>(`/memories/${encodeURIComponent(id)}/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ method, value, use_regex, dry_run }),
    }),

  batchCreate: (id: string, entries: Array<{ title: string; content: string; tags?: string[] }>) =>
    request<{ processed: number; entries: string[] }>(`/memories/${encodeURIComponent(id)}/batch`, {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),

  getConfig: () => request<Record<string, unknown>>('/config'),
  updateConfig: (updates: Record<string, unknown>) =>
    request<Record<string, unknown>>('/config', { method: 'PUT', body: JSON.stringify(updates) }),
};
