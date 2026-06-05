import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import {
  MEMLINK_VERSION,
  CONFIG_FILE,
  DEFAULT_PORT,
  DEFAULT_HOST,
  getMemlinkDir,
  type MemoryEntry,
  type UniversalMemory,
  type MemlinkConfig,
} from './types.ts';
import { findMemoryNameById, readMeta } from './meta.ts';
import {
  readAllEntries,
  createEntry,
  deleteEntry,
  searchEntries,
  getStorageStats,
} from './storage.ts';

export interface MemoryFileData {
  version: string;
  memoryId: string;
  memoryName: string;
  createdAt: string;
  updatedAt: string;
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

// ─── Atomic write helper ─────────────────────────────────────────────────────

function writeFileAtomic(filePath: string, data: string): void {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, data, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function getConfigPath(): string {
  return path.join(getMemlinkDir(), CONFIG_FILE);
}

export function getMemoryPath(memoryId: string): string {
  return path.join(getMemlinkDir(), `${memoryId}.memory.json`);
}

function getLegacyMemoryPath(memoryId: string): string {
  return path.join(getMemlinkDir(), `${memoryId}.memory.md`);
}

// ─── Config management ───────────────────────────────────────────────────────

export function ensureMemlinkDir(): void {
  const dir = getMemlinkDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Clean up legacy directories (.legacy-backups/ and .legacy-formats/) if they exist
  const legacyBackups = path.join(dir, '.legacy-backups');
  if (fs.existsSync(legacyBackups)) {
    try {
      fs.rmSync(legacyBackups, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }
  const legacyFormats = path.join(dir, '.legacy-formats');
  if (fs.existsSync(legacyFormats)) {
    try {
      fs.rmSync(legacyFormats, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
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
  writeFileAtomic(getConfigPath(), JSON.stringify(config, null, 2));
}

// ─── Universal Memory Management ──────────────────────────────────────────────

export function validateMemoryName(name: string, config: MemlinkConfig): string {
  const trimmed = name.trim();
  const allowed = /^[a-zA-Z0-9_.-]+$/;
  if (!allowed.test(trimmed)) {
    throw new Error(
      `Invalid memory name: "${name}". Only letters, numbers, and - _ . are allowed.`
    );
  }
  const dup = config.universalMemories.find(
    (m) => m.memoryName.toLowerCase() === trimmed.toLowerCase()
  );
  if (dup) {
    throw new Error(`Memory already exists: "${trimmed}" (ID: ${dup.memoryId})`);
  }
  return trimmed;
}

export function createUniversalMemory(rawName: string): UniversalMemory {
  ensureMemlinkDir();
  const config = loadConfig();
  const memoryName = validateMemoryName(rawName, config);

  const memoryId = nanoid(12);
  const memory: UniversalMemory = {
    memoryId,
    memoryName,
    createdAt: new Date().toISOString(),
  };

  config.universalMemories.push(memory);
  saveConfig(config);

  initMemoryFile(memoryId, memoryName);

  return memory;
}

export function getUniversalMemoryById(memoryId: string): UniversalMemory | undefined {
  const config = loadConfig();
  const fromConfig = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (fromConfig) return fromConfig;
  // Fallback: scan meta.json directories
  const name = findMemoryNameById(memoryId);
  if (name) {
    const meta = readMeta(name);
    if (meta) {
      return { memoryId: meta.id, memoryName: name, createdAt: meta.createdAt };
    }
  }
  return undefined;
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

  // Clean up new storage directory
  const name = config.universalMemories[idx].memoryName;
  const newDir = path.join(getMemlinkDir(), name);
  if (fs.existsSync(newDir)) {
    fs.rmSync(newDir, { recursive: true, force: true });
  }

  config.universalMemories.splice(idx, 1);
  saveConfig(config);
  return true;
}

// ─── Memory file format (JSON) ──────────────────────────────────────────────

export function initMemoryFile(memoryId: string, memoryName?: string): void {
  const displayName = memoryName || memoryId;
  const memDir = path.join(getMemlinkDir(), displayName);
  const indexPath = path.join(memDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(memDir, { recursive: true });
    const index = {
      memoryName: displayName,
      memoryId,
      nextId: 1,
      entries: [],
    };
    const tmp = indexPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf-8');
    fs.renameSync(tmp, indexPath);
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
  writeFileAtomic(memPath, JSON.stringify(data, null, 2));
}

export function getMemoryIndex(memoryId: string): {
  version: string;
  memoryId: string;
  memoryName: string;
  createdAt: string;
  updatedAt: string;
  entries: Array<{
    title: string;
    startLine?: number;
    endLine?: number;
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

  writeFileAtomic(getMemoryPath(memoryId), JSON.stringify(data, null, 2));
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

    if (trimmed === '## Index') {
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
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) return '# Memory not found';
  const entries = readAllEntries(memory.memoryName);
  const lines: string[] = [];

  lines.push(`# Memoria: ${memory.memoryName}`);
  lines.push('');
  lines.push(`> ID: ${memory.memoryId} | Entries: ${entries.length}`);
  lines.push('');
  lines.push('## Index');
  lines.push('');

  entries.forEach((entry, i) => {
    const tagStr = entry.tags && entry.tags.length > 0 ? ` _${entry.tags.join(', ')}_` : '';
    lines.push(`${i + 1}. **${entry.title}**${tagStr}`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  entries.forEach((entry) => {
    lines.push(`## ${entry.title}`);
    lines.push('');
    lines.push(entry.content);
    lines.push('');
  });

  return lines.join('\n');
}

export function renderMemoryAsText(memoryId: string): string {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) return 'Memory not found';
  const entries = readAllEntries(memory.memoryName);
  const lines: string[] = [];

  lines.push(`Memoria: ${memory.memoryName}`);
  lines.push(`ID: ${memory.memoryId} | Entries: ${entries.length}`);
  lines.push('');

  entries.forEach((entry, i) => {
    lines.push(`[${i + 1}] ${entry.title}`);
    if (entry.tags && entry.tags.length > 0) {
      lines.push(`    Tags: ${entry.tags.join(', ')}`);
    }
    lines.push(`    ${entry.content.replace(/\n/g, '\n    ')}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function renderMemoryAsHtml(memoryId: string): string {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) return '<h1>Memory not found</h1>';
  const entries = readAllEntries(memory.memoryName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(memory.memoryName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #e6edf3; background: #000; -webkit-font-smoothing: antialiased; }
    h1 { font-size: 1.8rem; margin-bottom: 0.25rem; font-weight: 600; }
    .meta { color: #666; font-size: 0.85rem; margin-bottom: 2rem; }
    .index { margin-bottom: 2rem; }
    .index a { color: #00e5a0; text-decoration: none; }
    .index a:hover { text-decoration: underline; }
    article { margin-bottom: 1.5rem; padding: 1rem; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px; }
    article h2 { font-size: 1.2rem; margin-bottom: 0.5rem; font-weight: 600; }
    .tags { margin-bottom: 0.5rem; }
    .tag { display: inline-block; padding: 0.15rem 0.5rem; font-size: 0.75rem; background: rgba(0, 229, 160, 0.08); color: #00e5a0; border: 1px solid rgba(0, 229, 160, 0.15); border-radius: 4px; margin-right: 0.25rem; }
    .content { line-height: 1.6; color: #999; }
    hr { border: none; border-top: 1px solid #1a1a1a; margin: 1.5rem 0; }
    @media print { body { background: #fff; color: #000; } article { border-color: #ccc; background: #fff; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(memory.memoryName)}</h1>
    <p class="meta">ID: ${escapeHtml(memory.memoryId)} | Entries: ${entries.length}</p>
  </header>
  <nav class="index">
    <h2>Index</h2>
    <ol>
      ${entries.map((entry, i) => `<li><a href="#entry-${i + 1}">${escapeHtml(entry.title)}</a></li>`).join('\n      ')}
    </ol>
  </nav>
  <hr>
  <main>
    ${entries.map((entry, i) => `<section id="entry-${i + 1}">${entry.tags?.length ? `<p class="tags">${entry.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</p>` : ''}<article><h2>${escapeHtml(entry.title)}</h2><div class="content">${escapeHtml(entry.content).replace(/\n/g, '<br>')}</div></article></section>`).join('\n    ')}
  </main>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getExportsDir(): string {
  const dir = path.join(getMemlinkDir(), 'exports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function exportMemoryFormats(memoryId: string): string[] {
  const exportsDir = getExportsDir();
  const memory = getMemoryById(memoryId);
  const name = memory?.memoryName || memoryId;
  const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const written: string[] = [];

  const entries = readAllEntries(name);
  const p = path.join(exportsDir, `${safeName}.json`);
  writeFileAtomic(p, JSON.stringify({ memoryId, memoryName: name, entries }, null, 2));
  written.push(p);

  return written;
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

export function readMemory(memoryId: string): MemoryEntry[] {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) return [];
  return readAllEntries(memory.memoryName);
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
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);
  createEntry(memory.memoryName, memoryId, title, content, tags);
  return { title, content, tags, startLine: 0, endLine: 0, updatedAt: new Date().toISOString() };
}

export function deleteMemoryEntry(memoryId: string, title: string): boolean {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) return false;
  return deleteEntry(memory.memoryName, title);
}

export function syncMemory(memoryId: string): { entries: number; size: number } {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);
  const stats = getStorageStats(memory.memoryName);
  if (!stats) throw new Error(`Memory not found: ${memoryId}`);
  return { entries: stats.entries, size: stats.size };
}

// ─── Search ────────────────────────────────────────────────────────────────────

export function searchMemory(memoryId: string, query: string): MemoryEntry[] {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) return [];
  return searchEntries(memory.memoryName, query);
}

// ─── Statistics ───────────────────────────────────────────────────────────────────

export function getStats(memoryId: string): MemoryStats {
  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const stats = getStorageStats(memory.memoryName);
  if (!stats) throw new Error(`Memory not found: ${memoryId}`);

  const entries = readAllEntries(memory.memoryName);
  const allTags = new Set<string>();
  let oldest: string | null = null;
  let newest: string | null = null;

  for (const entry of entries) {
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

// ─── Import ─────────────────────────────────────────────────────────────────────

export interface ImportOptions {
  merge?: boolean;
  overwrite?: boolean;
}

export function importFromFile(
  memoryId: string,
  filePath: string,
  options?: ImportOptions
): { imported: number; skipped: number } {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');

  const parsed = JSON.parse(raw);

  const imported: { title: string; content: string; tags?: string[] }[] = Array.isArray(parsed)
    ? parsed
    : parsed.entries && Array.isArray(parsed.entries)
      ? parsed.entries
      : parsed.title && parsed.content !== undefined
        ? [parsed]
        : (() => {
            throw new Error(
              'Unrecognized import format. Expected an array of entries or { entries: [...] }.'
            );
          })();

  const memory = getUniversalMemoryById(memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);
  let importedCount = 0;
  let skippedCount = 0;

  const readExisting = () => {
    try {
      return readAllEntries(memory.memoryName).map((e) => e.title.toLowerCase());
    } catch {
      return [] as string[];
    }
  };

  for (const entry of imported) {
    if (!entry.title || entry.content === undefined) {
      skippedCount++;
      continue;
    }
    const existingTitles = readExisting();
    if (existingTitles.includes(entry.title.toLowerCase()) && !options?.overwrite) {
      skippedCount++;
      continue;
    }
    createEntry(memory.memoryName, memoryId, entry.title, entry.content, entry.tags);
    importedCount++;
  }

  return { imported: importedCount, skipped: skippedCount };
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

  writeFileAtomic(filename, JSON.stringify(backup, null, 2));
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
  keepCount = 3
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
  exportMemoryFormats(memoryId);
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
  exportMemoryFormats(memoryId);
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
  exportMemoryFormats(memoryId);
  return { deleted: deletedEntries.length, entries: deletedEntries };
}
