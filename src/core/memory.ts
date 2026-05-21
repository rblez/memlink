import fs from 'fs';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';
import { MemlinkConfig, UniversalMemory, MemoryEntry } from './types.ts';
import { MEMLINK_VERSION, CONFIG_DIR, CONFIG_FILE, DEFAULT_PORT, DEFAULT_HOST } from './types.ts';

export interface MemoryFileData {
  version: string;
  memoryId: string;
  memoryName: string;
  createdAt: string;
  updatedAt: string;
  entries: MemoryEntry[];
}

export interface MemoryExport {
  version: string;
  exportedAt: string;
  memoryId: string;
  memoryName?: string;
  entries: MemoryEntry[];
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

export interface BackupMetadata {
  version: string;
  createdAt: string;
  memoryId: string;
  entryCount: number;
  totalSize: number;
  tags: string[];
  checksum: string;
}

export interface MemoryBackup {
  metadata: BackupMetadata;
  entries: MemoryEntry[];
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function getMemlinkDir(): string {
  return path.join(os.homedir(), CONFIG_DIR);
}

export function getConfigPath(): string {
  return path.join(getMemlinkDir(), CONFIG_FILE);
}

export function getMemoryPath(memoryId: string): string {
  return path.join(getMemlinkDir(), `${memoryId}.memory.json`);
}

export function getLegacyMemoryPath(memoryId: string): string {
  return path.join(getMemlinkDir(), `${memoryId}.memory.md`);
}

// ─── Config management ───────────────────────────────────────────────────────

export function ensureMemlinkDir(): void {
  const dir = getMemlinkDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): MemlinkConfig {
  ensureMemlinkDir();
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    const defaultConfig: MemlinkConfig = {
      version: MEMLINK_VERSION,
      baseDir: getMemlinkDir(),
      universalMemories: [],
      serverPort: DEFAULT_PORT,
      serverHost: DEFAULT_HOST,
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as MemlinkConfig;
  if (!raw.universalMemories) raw.universalMemories = [];
  return raw;
}

export function saveConfig(config: MemlinkConfig): void {
  ensureMemlinkDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

// ─── Universal Memory Management ──────────────────────────────────────────────

export function createUniversalMemory(memoryName: string): UniversalMemory {
  ensureMemlinkDir();
  const config = loadConfig();

  const memoryId = nanoid(12);
  const memory: UniversalMemory = {
    memoryId,
    memoryName,
    memoryFile: `${memoryId}.memory.json`,
    createdAt: new Date().toISOString(),
  };

  config.universalMemories.push(memory);
  saveConfig(config);

  initMemoryFile(memoryId, memoryName);

  return memory;
}

export function getUniversalMemoryById(memoryId: string): UniversalMemory | undefined {
  const config = loadConfig();
  return config.universalMemories.find((m) => m.memoryId === memoryId);
}

export function getMemoryById(memId: string): { memoryId: string; memoryName: string } | undefined {
  const memory = getUniversalMemoryById(memId);
  if (!memory) return undefined;
  return { memoryId: memory.memoryId, memoryName: memory.memoryName };
}

export function updateUniversalMemoryLastSeen(memoryId: string): void {
  const config = loadConfig();
  const memory = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (memory) {
    memory.lastSeen = new Date().toISOString();
    saveConfig(config);
  }
}

export function revokeUniversalMemory(memoryId: string): boolean {
  const config = loadConfig();
  const idx = config.universalMemories.findIndex((m) => m.memoryId === memoryId);
  if (idx === -1) return false;

  const memPath = getMemoryPath(memoryId);
  if (fs.existsSync(memPath)) fs.unlinkSync(memPath);

  const legacyPath = getLegacyMemoryPath(memoryId);
  if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);

  config.universalMemories.splice(idx, 1);
  saveConfig(config);
  return true;
}

// ─── Memory file format (JSON) ──────────────────────────────────────────────

export function initMemoryFile(memoryId: string, memoryName?: string): void {
  const memPath = getMemoryPath(memoryId);
  if (!fs.existsSync(memPath)) {
    const displayName = memoryName || memoryId;
    const now = new Date().toISOString();
    const data: MemoryFileData = {
      version: MEMLINK_VERSION,
      memoryId,
      memoryName: displayName,
      createdAt: now,
      updatedAt: now,
      entries: [],
    };
    fs.writeFileSync(memPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

export function loadMemoryFile(memoryId: string): MemoryFileData {
  const memPath = getMemoryPath(memoryId);

  if (!fs.existsSync(memPath)) {
    const legacyPath = getLegacyMemoryPath(memoryId);
    if (fs.existsSync(legacyPath)) {
      migrateMemoryFormat(memoryId);
      const newData = fs.readFileSync(getMemoryPath(memoryId), 'utf-8');
      return JSON.parse(newData) as MemoryFileData;
    }
    throw new Error(`Memory file not found: ${memoryId}`);
  }

  const raw = fs.readFileSync(memPath, 'utf-8');
  return JSON.parse(raw) as MemoryFileData;
}

export function saveMemoryFile(memoryId: string, data: MemoryFileData): void {
  const memPath = getMemoryPath(memoryId);
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(memPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getMemoryIndex(memoryId: string): {
  version: string;
  memoryId: string;
  memoryName: string;
  createdAt: string;
  updatedAt: string;
  entries: Array<{
    title: string;
    startLine: number;
    endLine: number;
    tags?: string[];
    updatedAt: string;
  }>;
} {
  const data = loadMemoryFile(memoryId);
  return {
    version: data.version,
    memoryId: data.memoryId,
    memoryName: data.memoryName,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    entries: data.entries.map((e) => ({
      title: e.title,
      startLine: e.startLine,
      endLine: e.endLine,
      tags: e.tags,
      updatedAt: e.updatedAt,
    })),
  };
}

// ─── Migration: .memory.md → .memory.json ───────────────────────────────────

function migrateMemoryFormat(memoryId: string): void {
  const legacyPath = getLegacyMemoryPath(memoryId);
  if (!fs.existsSync(legacyPath)) return;

  const raw = fs.readFileSync(legacyPath, 'utf-8');
  const lines = raw.split('\n');

  const isBookFormat = lines.some((line) => line.trim().startsWith('# Memoria:'));

  let entries: MemoryEntry[] = [];
  let memoryName = memoryId;

  if (isBookFormat) {
    const result = parseBookFormat(memoryId, lines);
    entries = result.entries;
    memoryName = result.memoryName || memoryId;
  }

  const now = new Date().toISOString();
  const data: MemoryFileData = {
    version: MEMLINK_VERSION,
    memoryId,
    memoryName,
    createdAt: entries.length > 0 ? entries[0].updatedAt : now,
    updatedAt: now,
    entries,
  };

  fs.writeFileSync(getMemoryPath(memoryId), JSON.stringify(data, null, 2), 'utf-8');
  fs.unlinkSync(legacyPath);
}

function parseBookFormat(
  memoryId: string,
  lines: string[]
): { memoryName: string; entries: MemoryEntry[] } {
  const entries: MemoryEntry[] = [];
  let memoryName = '';
  let inIndex = false;
  let inContent = false;
  let currentEntry: Partial<MemoryEntry> | null = null;
  let contentLines: string[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('# Memoria:')) {
      memoryName = trimmed.replace('# Memoria:', '').trim();
      continue;
    }

    if (trimmed === '## Indice') {
      inIndex = true;
      continue;
    }

    if (trimmed === '---' && inIndex) {
      inIndex = false;
      inContent = true;
      continue;
    }

    if (inContent) {
      const numberedMatch = line.match(/^(\d+):\s*(.*)$/);
      if (numberedMatch) {
        if (currentEntry && currentEntry.title) {
          entries.push({
            ...(currentEntry as MemoryEntry),
            content: contentLines.join('\n'),
          });
          contentLines = [];
        }

        const entryNumber = parseInt(numberedMatch[1]);
        currentEntry = {
          title: `Entry ${entryNumber}`,
          content: '',
          startLine: entryNumber,
          endLine: entryNumber,
          tags: undefined,
          updatedAt: now,
        };

        if (numberedMatch[2]) {
          contentLines.push(numberedMatch[2]);
        }
      } else if (currentEntry) {
        contentLines.push(line);
      }
    }
  }

  if (currentEntry && currentEntry.title) {
    entries.push({
      ...(currentEntry as MemoryEntry),
      content: contentLines.join('\n'),
    });
  }

  return { memoryName: memoryName || memoryId, entries };
}

// ─── Renderers ──────────────────────────────────────────────────────────────

export function renderMemoryAsMarkdown(memoryId: string): string {
  const data = loadMemoryFile(memoryId);
  const lines: string[] = [];

  lines.push(`# Memoria: ${data.memoryName}`);
  lines.push('');
  lines.push(
    `> ID: ${data.memoryId} | Entries: ${data.entries.length} | Updated: ${data.updatedAt}`
  );
  lines.push('');
  lines.push('## Indice');
  lines.push('');

  data.entries.forEach((entry, i) => {
    const tagStr = entry.tags && entry.tags.length > 0 ? ` _${entry.tags.join(', ')}_` : '';
    lines.push(`${i + 1}. **${entry.title}**${tagStr}`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  data.entries.forEach((entry) => {
    lines.push(`## ${entry.title}`);
    lines.push('');
    lines.push(entry.content);
    lines.push('');
  });

  return lines.join('\n');
}

export function renderMemoryAsText(memoryId: string): string {
  const data = loadMemoryFile(memoryId);
  const lines: string[] = [];

  lines.push(`Memoria: ${data.memoryName}`);
  lines.push(`ID: ${data.memoryId} | Entries: ${data.entries.length}`);
  lines.push('');

  data.entries.forEach((entry, i) => {
    lines.push(`[${i + 1}] ${entry.title}`);
    if (entry.tags && entry.tags.length > 0) {
      lines.push(`    Tags: ${entry.tags.join(', ')}`);
    }
    lines.push(`    ${entry.content.replace(/\n/g, '\n    ')}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function renderEntryAsMarkdown(entry: MemoryEntry): string {
  const lines: string[] = [];
  lines.push(`## ${entry.title}`);
  if (entry.tags && entry.tags.length > 0) {
    lines.push(`_Tags: ${entry.tags.join(', ')}_`);
    lines.push('');
  }
  lines.push(entry.content);
  return lines.join('\n');
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

export function readMemory(memoryId: string): MemoryEntry[] {
  const data = loadMemoryFile(memoryId);
  return data.entries;
}

export function readMemoryEntry(memoryId: string, title: string): MemoryEntry | undefined {
  const entries = readMemory(memoryId);
  return entries.find((e) => e.title.toLowerCase() === title.toLowerCase());
}

export function upsertMemoryEntry(
  memoryId: string,
  title: string,
  content: string,
  tags?: string[]
): MemoryEntry {
  const data = loadMemoryFile(memoryId);
  const now = new Date().toISOString();
  const existing = data.entries.findIndex((e) => e.title.toLowerCase() === title.toLowerCase());

  const entry: MemoryEntry = {
    title,
    content,
    startLine: 0,
    endLine: 0,
    tags,
    updatedAt: now,
  };

  if (existing >= 0) {
    data.entries[existing] = entry;
  } else {
    data.entries.push(entry);
  }

  saveMemoryFile(memoryId, data);

  return entry;
}

export function deleteMemoryEntry(memoryId: string, title: string): boolean {
  const data = loadMemoryFile(memoryId);
  const idx = data.entries.findIndex((e) => e.title.toLowerCase() === title.toLowerCase());
  if (idx === -1) return false;

  data.entries.splice(idx, 1);
  saveMemoryFile(memoryId, data);
  return true;
}

export function syncMemory(memoryId: string): { entries: number; size: number } {
  const memPath = getMemoryPath(memoryId);
  if (!fs.existsSync(memPath)) throw new Error('Memory file not found');

  const data = loadMemoryFile(memoryId);
  const stats = fs.statSync(memPath);

  return {
    entries: data.entries.length,
    size: stats.size,
  };
}

// ─── Search ────────────────────────────────────────────────────────────────────

export function searchMemory(memoryId: string, query: string): MemoryEntry[] {
  const entries = readMemory(memoryId);
  const lowerQuery = query.toLowerCase();

  return entries.filter((entry) => {
    const titleMatch = entry.title.toLowerCase().includes(lowerQuery);
    const contentMatch = entry.content.toLowerCase().includes(lowerQuery);
    const tagMatch = entry.tags?.some((t) => t.toLowerCase().includes(lowerQuery)) ?? false;
    return titleMatch || contentMatch || tagMatch;
  });
}

// ─── Export/Import ──────────────────────────────────────────────────────────────

export function exportMemory(memoryId: string): MemoryExport {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const data = loadMemoryFile(memoryId);

  return {
    version: MEMLINK_VERSION,
    exportedAt: new Date().toISOString(),
    memoryId,
    memoryName: data.memoryName,
    entries: data.entries,
  };
}

export function importMemory(memoryId: string, data: MemoryExport): number {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const fileData = loadMemoryFile(memoryId);
  const merged = new Map<string, MemoryEntry>();

  for (const entry of fileData.entries) {
    merged.set(entry.title.toLowerCase(), entry);
  }

  for (const entry of data.entries) {
    merged.set(entry.title.toLowerCase(), {
      ...entry,
      updatedAt: new Date().toISOString(),
    });
  }

  fileData.entries = Array.from(merged.values());
  saveMemoryFile(memoryId, fileData);

  return data.entries.length;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export function getStats(memoryId: string): MemoryStats {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const data = loadMemoryFile(memoryId);
  const stats = syncMemory(memoryId);

  const allTags = new Set<string>();
  let oldest: string | null = null;
  let newest: string | null = null;

  for (const entry of data.entries) {
    if (entry.tags) {
      for (const tag of entry.tags) allTags.add(tag);
    }
    if (!oldest || entry.updatedAt < oldest) oldest = entry.updatedAt;
    if (!newest || entry.updatedAt > newest) newest = entry.updatedAt;
  }

  return {
    memoryId,
    memoryName: memory.memoryName,
    entries: stats.entries,
    size: stats.size,
    oldestEntry: oldest,
    newestEntry: newest,
    tags: Array.from(allTags),
    lastSeen: memory.lastSeen ?? null,
    createdAt: memory.createdAt,
  };
}

// ─── Backup & Restore ───────────────────────────────────────────────────────────

export function createBackup(memoryId: string, includeDeleted = false): MemoryBackup {
  const entries = readMemory(memoryId);
  const filteredEntries = includeDeleted
    ? entries
    : entries.filter((e) => !e.title.startsWith('_DELETED_'));

  const allTags = filteredEntries.flatMap((e) => e.tags || []);
  const uniqueTags = Array.from(new Set(allTags));
  const totalSize = JSON.stringify(filteredEntries).length;
  const checksum = nanoid(16);

  return {
    metadata: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      memoryId,
      entryCount: filteredEntries.length,
      totalSize,
      tags: uniqueTags,
      checksum,
    },
    entries: filteredEntries,
  };
}

export function saveBackup(memoryId: string, backupPath?: string): string {
  const backup = createBackup(memoryId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = backupPath || `${getMemlinkDir()}/backups/${memoryId}_${timestamp}.json`;

  const backupDir = path.dirname(filename);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
  return filename;
}

export function restoreBackup(
  backupPath: string,
  targetMemoryId?: string,
  overwrite = false
): { restored: number; memoryId: string } {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const backup: MemoryBackup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const memoryId = targetMemoryId || backup.metadata.memoryId;

  const memoryExists = fs.existsSync(getMemoryPath(memoryId));

  if (memoryExists && !overwrite) {
    throw new Error(`Memory '${memoryId}' already exists. Use overwrite=true to replace it.`);
  }

  if (!memoryExists) {
    initMemoryFile(memoryId);
  }

  const data = loadMemoryFile(memoryId);
  data.entries = backup.entries;
  saveMemoryFile(memoryId, data);

  return {
    restored: backup.entries.length,
    memoryId,
  };
}

export function listBackups(memoryId?: string): Array<{
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
  memoryId: string;
  entryCount: number;
}> {
  const backupDir = `${getMemlinkDir()}/backups`;

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => !memoryId || file.includes(memoryId))
    .map((file) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);

      try {
        const backup: MemoryBackup = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          createdAt: stats.mtime,
          memoryId: backup.metadata.memoryId,
          entryCount: backup.metadata.entryCount,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{
    filename: string;
    path: string;
    size: number;
    createdAt: Date;
    memoryId: string;
    entryCount: number;
  }>;

  return files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function deleteBackup(backupPath: string): boolean {
  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function cleanupOldBackups(
  memoryId?: string,
  keepCount = 10
): { deleted: number; kept: number } {
  const backups = listBackups(memoryId);

  if (backups.length <= keepCount) {
    return { deleted: 0, kept: backups.length };
  }

  const toDelete = backups.slice(keepCount);
  let deleted = 0;

  for (const backup of toDelete) {
    if (deleteBackup(backup.path)) {
      deleted++;
    }
  }

  return {
    deleted,
    kept: backups.length - deleted,
  };
}

// ─── Bulk Delete ──────────────────────────────────────────────────────────────

export function bulkDeleteMemories(
  memoryId: string,
  titles: string[]
): { deleted: number; notFound: string[] } {
  const data = loadMemoryFile(memoryId);
  const titlesLower = titles.map((t) => t.toLowerCase());
  const deletedEntries = data.entries.filter((e) => titlesLower.includes(e.title.toLowerCase()));
  data.entries = data.entries.filter((e) => !titlesLower.includes(e.title.toLowerCase()));
  saveMemoryFile(memoryId, data);
  return {
    deleted: deletedEntries.length,
    notFound: titles.filter(
      (title) => !data.entries.some((e) => e.title.toLowerCase() === title.toLowerCase())
    ),
  };
}

export function bulkDeleteMemoriesByTags(
  memoryId: string,
  tags: string[]
): { deleted: number; entries: MemoryEntry[] } {
  const data = loadMemoryFile(memoryId);
  const tagsLower = tags.map((t) => t.toLowerCase());
  const deletedEntries = data.entries.filter((entry) =>
    entry.tags?.some((tag) => tagsLower.includes(tag.toLowerCase()))
  );
  data.entries = data.entries.filter(
    (entry) => !entry.tags?.some((tag) => tagsLower.includes(tag.toLowerCase()))
  );
  saveMemoryFile(memoryId, data);
  return { deleted: deletedEntries.length, entries: deletedEntries };
}

export function bulkDeleteMemoriesByPattern(
  memoryId: string,
  pattern: string,
  useRegex = false
): { deleted: number; entries: MemoryEntry[] } {
  const data = loadMemoryFile(memoryId);
  let deletedEntries: MemoryEntry[] = [];

  if (useRegex) {
    try {
      const regex = new RegExp(pattern, 'i');
      deletedEntries = data.entries.filter(
        (entry) => regex.test(entry.title) || regex.test(entry.content)
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid regex pattern: ${message}`, { cause: error });
    }
  } else {
    const patternLower = pattern.toLowerCase();
    deletedEntries = data.entries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(patternLower) ||
        entry.content.toLowerCase().includes(patternLower)
    );
  }

  data.entries = data.entries.filter((entry) => !deletedEntries.includes(entry));
  saveMemoryFile(memoryId, data);
  return { deleted: deletedEntries.length, entries: deletedEntries };
}
