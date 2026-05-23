export interface MemoryEntry {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
  tags?: string[];
  updatedAt: string;
}

export interface UniversalMemory {
  memoryId: string;
  memoryName: string;
  memoryFile: string;
  createdAt: string;
  lastSeen?: string;
}

export interface MemlinkConfig {
  version: string;
  baseDir: string;
  universalMemories: UniversalMemory[];
  serverPort: number;
  serverHost: string;
}

export const MEMLINK_VERSION = '1.0.8';
export const DEFAULT_PORT = 4444;
export const DEFAULT_HOST = 'localhost';
export const CONFIG_DIR = '.memlink';
export const CONFIG_FILE = 'config.json';
