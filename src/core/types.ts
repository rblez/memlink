import path from 'path';
import os from 'os';

export interface MemoryEntry {
  id?: number;
  title: string;
  content: string;
  tags?: string[];
  updatedAt: string;
  startLine?: number;
  endLine?: number;
}

export interface UniversalMemory {
  memoryId: string;
  memoryName: string;
  createdAt: string;
  lastSeen?: string;
}

export interface MemlinkConfig {
  version: string;
  baseDir: string;
  universalMemories: UniversalMemory[];
  serverPort: number;
  serverHost: string;
  cors?: string;
  readOnly?: boolean;
}

export interface StorageEntry {
  id: number;
  title: string;
  content: string;
  tags?: string[];
  updatedAt: string;
}

export interface StorageIndex {
  memoryName: string;
  memoryId: string;
  nextId: number;
  entries: Array<{
    id: number;
    title: string;
    tags?: string[];
    updatedAt: string;
  }>;
}

export interface LockFile {
  pid: number;
  hostname: string;
  lockedAt: number;
}

export const MEMLINK_VERSION = '1.0.12';
export const DEFAULT_PORT = 4444;
export const DEFAULT_HOST = 'localhost';
export const CONFIG_DIR = '.memlink';
export const CONFIG_FILE = 'settings.json';
export const LOCK_TTL = 10_000;

export function getMemlinkDir(): string {
  return process.env.MEMLINK_DIR || path.join(os.homedir(), CONFIG_DIR);
}
