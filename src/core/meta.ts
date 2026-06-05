import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getMemlinkDir, memoryDir, DEFAULT_MEMORY, type MemoryMeta } from './types.ts';

export function findMemoryNameById(memoryId: string): string | null {
  const dir = getMemlinkDir();
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(dir, entry.name, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.id === memoryId) return entry.name;
    }
  } catch {
    // ignore
  }
  return null;
}

function metaPath(memoryName: string): string {
  return path.join(memoryDir(memoryName), 'meta.json');
}

export function readMeta(memoryName: string): MemoryMeta | null {
  try {
    const raw = fs.readFileSync(metaPath(memoryName), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeMeta(memoryName: string, meta: MemoryMeta): void {
  const dir = memoryDir(memoryName);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = metaPath(memoryName) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8');
  fs.renameSync(tmp, metaPath(memoryName));
}

export function createMemoryMeta(memoryName: string, token?: string): MemoryMeta {
  const meta: MemoryMeta = {
    id: nanoid(12),
    token,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  writeMeta(memoryName, meta);
  return meta;
}

export function ensureDefaultMemory(): MemoryMeta {
  const existing = readMeta(DEFAULT_MEMORY);
  if (existing) return existing;
  return createMemoryMeta(DEFAULT_MEMORY);
}

export function updateMetaStatus(memoryName: string, status: MemoryMeta['status']): boolean {
  const meta = readMeta(memoryName);
  if (!meta) return false;
  meta.status = status;
  writeMeta(memoryName, meta);
  return true;
}

export function updateLastServed(memoryName: string): void {
  const meta = readMeta(memoryName);
  if (!meta) return;
  meta.lastServedAt = new Date().toISOString();
  writeMeta(memoryName, meta);
}
