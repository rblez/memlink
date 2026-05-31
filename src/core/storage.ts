import fs from 'fs';
import path from 'path';
import { getMemlinkDir, type StorageIndex, type StorageEntry } from './types.ts';
import { withLock } from './lock.ts';

function memoryDir(memoryName: string): string {
  return path.join(getMemlinkDir(), memoryName);
}

function indexPath(memoryName: string): string {
  return path.join(memoryDir(memoryName), 'index.json');
}

function entryPath(memoryName: string, id: number): string {
  return path.join(memoryDir(memoryName), `${id}.json`);
}

function backupsDir(memoryName: string): string {
  const dir = path.join(memoryDir(memoryName), '.backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Index ────────────────────────────────────────────────────────────────────

export function readIndex(memoryName: string): StorageIndex | null {
  try {
    const raw = fs.readFileSync(indexPath(memoryName), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeIndex(memoryName: string, index: StorageIndex): void {
  const dir = memoryDir(memoryName);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = indexPath(memoryName) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf-8');
  fs.renameSync(tmp, indexPath(memoryName));
}

// ── Entries ───────────────────────────────────────────────────────────────────

export function readEntry(memoryName: string, id: number): StorageEntry | null {
  try {
    const raw = fs.readFileSync(entryPath(memoryName, id), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function findEntryByTitle(memoryName: string, title: string): StorageEntry | null {
  const index = readIndex(memoryName);
  if (!index) return null;
  const found = index.entries.find((e) => e.title.toLowerCase() === title.toLowerCase());
  if (!found) return null;
  return readEntry(memoryName, found.id);
}

function writeEntryRaw(memoryName: string, entry: StorageEntry): void {
  const dir = memoryDir(memoryName);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = entryPath(memoryName, entry.id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entry, null, 2), 'utf-8');
  fs.renameSync(tmp, entryPath(memoryName, entry.id));
}

function backupEntry(memoryName: string, id: number): void {
  const entry = readEntry(memoryName, id);
  if (!entry) return;
  const dir = backupsDir(memoryName);
  const file = path.join(dir, `${id}_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createEntry(
  memoryName: string,
  memoryId: string,
  title: string,
  content: string,
  tags?: string[]
): { id: number } {
  return withLock(memoryDir(memoryName), () => {
    let index = readIndex(memoryName);
    if (!index) {
      index = { memoryName, memoryId, nextId: 1, entries: [] };
    }

    // Check if title already exists — update instead
    const existing = index.entries.find((e) => e.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      const entry = readEntry(memoryName, existing.id);
      if (entry) {
        backupEntry(memoryName, existing.id);
        entry.content = content;
        if (tags) entry.tags = tags;
        entry.updatedAt = new Date().toISOString();
        writeEntryRaw(memoryName, entry);

        existing.updatedAt = entry.updatedAt;
        if (tags) existing.tags = tags;
        writeIndex(memoryName, index);
        return { id: existing.id };
      }
    }

    const id = index.nextId++;
    const now = new Date().toISOString();
    const entry: StorageEntry = { id, title, content, tags, updatedAt: now };
    writeEntryRaw(memoryName, entry);

    index.entries.push({ id, title, tags, updatedAt: now });
    writeIndex(memoryName, index);
    return { id };
  });
}

export function updateEntry(
  memoryName: string,
  id: number,
  data: { title?: string; content?: string; tags?: string[] }
): boolean {
  return withLock(memoryDir(memoryName), () => {
    const entry = readEntry(memoryName, id);
    if (!entry) return false;

    backupEntry(memoryName, id);

    if (data.title !== undefined) entry.title = data.title;
    if (data.content !== undefined) entry.content = data.content;
    if (data.tags !== undefined) entry.tags = data.tags;
    entry.updatedAt = new Date().toISOString();
    writeEntryRaw(memoryName, entry);

    // Update index
    const index = readIndex(memoryName);
    if (index) {
      const idx = index.entries.findIndex((e) => e.id === id);
      if (idx !== -1) {
        index.entries[idx].title = entry.title;
        index.entries[idx].tags = entry.tags;
        index.entries[idx].updatedAt = entry.updatedAt;
        writeIndex(memoryName, index);
      }
    }
    return true;
  });
}

export function deleteEntry(memoryName: string, idOrTitle: number | string): boolean {
  return withLock(memoryDir(memoryName), () => {
    const index = readIndex(memoryName);
    if (!index) return false;

    let id: number;
    if (typeof idOrTitle === 'number') {
      id = idOrTitle;
    } else {
      const found = index.entries.find((e) => e.title.toLowerCase() === idOrTitle.toLowerCase());
      if (!found) return false;
      id = found.id;
    }

    // Delete entry file
    const ePath = entryPath(memoryName, id);
    if (fs.existsSync(ePath)) {
      backupEntry(memoryName, id);
      fs.unlinkSync(ePath);
    }

    // Update index
    index.entries = index.entries.filter((e) => e.id !== id);
    writeIndex(memoryName, index);
    return true;
  });
}

export function readAllEntries(memoryName: string): StorageEntry[] {
  const index = readIndex(memoryName);
  if (!index) return [];
  const entries: StorageEntry[] = [];
  for (const e of index.entries) {
    const entry = readEntry(memoryName, e.id);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function searchEntries(memoryName: string, query: string): StorageEntry[] {
  const q = query.toLowerCase();
  const index = readIndex(memoryName);
  if (!index) return [];

  // First pass: match titles (fast, no disk reads)
  const titleMatches = index.entries.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      (e.tags && e.tags.some((t) => t.toLowerCase().includes(q)))
  );
  if (titleMatches.length > 0) {
    return titleMatches
      .map((e) => readEntry(memoryName, e.id))
      .filter((e): e is StorageEntry => e !== null);
  }

  // Second pass: search content
  const results: StorageEntry[] = [];
  for (const e of index.entries) {
    const entry = readEntry(memoryName, e.id);
    if (entry && entry.content.toLowerCase().includes(q)) {
      results.push(entry);
    }
  }
  return results;
}

// ── Migrate legacy .memory.json ───────────────────────────────────────────────

export function migrateLegacyFile(memoryId: string, memoryName: string): void {
  const legacyPath = path.join(getMemlinkDir(), `${memoryId}.memory.json`);
  if (!fs.existsSync(legacyPath)) return;

  const raw = fs.readFileSync(legacyPath, 'utf-8');
  let entries: Array<{ title: string; content: string; tags?: string[]; updatedAt: string }>;
  try {
    const parsed = JSON.parse(raw);
    entries = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(entries) || entries.length === 0) return;
  } catch {
    return;
  }

  withLock(memoryDir(memoryName), () => {
    // Check if already migrated
    if (readIndex(memoryName)) return;

    const index: StorageIndex = {
      memoryName,
      memoryId,
      nextId: 1,
      entries: [],
    };

    for (const e of entries) {
      const id = index.nextId++;
      const entry: StorageEntry = {
        id,
        title: e.title,
        content: e.content,
        tags: e.tags,
        updatedAt: e.updatedAt,
      };
      writeEntryRaw(memoryName, entry);
      index.entries.push({ id, title: e.title, tags: e.tags, updatedAt: e.updatedAt });
    }

    writeIndex(memoryName, index);

    // Rename legacy file as backup
    fs.renameSync(legacyPath, legacyPath + '.bak');
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getStorageStats(memoryName: string): {
  entries: number;
  size: number;
  lastUpdated: string | null;
} | null {
  const index = readIndex(memoryName);
  if (!index) return null;

  const sorted = [...index.entries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return {
    entries: index.entries.length,
    size: index.entries.length * 2, // rough estimate in KB
    lastUpdated: sorted[0]?.updatedAt ?? null,
  };
}
