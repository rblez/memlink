import fs from "fs";
import path from "path";
import os from "os";
import { nanoid } from "nanoid";
import {
  MemlinkConfig,
  UniversalMemory,
  MemoryEntry,
  MemoryIndexEntry,
  KNOWN_AGENTS,
  KnownAgent,
  AgentToken,
} from "./types.ts";
import {
  MEMLINK_VERSION,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_PORT,
  DEFAULT_HOST,
} from "./types.ts";

// ─── Additional Types (defined here to avoid circular imports) ───────────────────────

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
  tags: string[];
  lastSeen: string | null;
  createdAt: string;
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function getMemlinkDir(): string {
  return path.join(os.homedir(), CONFIG_DIR);
}

export function getConfigPath(): string {
  return path.join(getMemlinkDir(), CONFIG_FILE);
}

export function getMemoryPath(memoryId: string): string {
  return path.join(getMemlinkDir(), `${memoryId}.memory.md`);
}

export function getAgentMemoryPath(agentId: string): string {
  return path.join(getMemlinkDir(), `${agentId}.memory`);
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
      agents: [],
      universalMemories: [],
      serverPort: DEFAULT_PORT,
      serverHost: DEFAULT_HOST,
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8")) as MemlinkConfig;
}

export function saveConfig(config: MemlinkConfig): void {
  ensureMemlinkDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

// ─── Token management ────────────────────────────────────────────────────────

export function generateToken(): string {
  return `memlink_${nanoid(32)}`;
}

export function createAgent(agentType: KnownAgent | string, customName?: string): AgentToken {
  const config = loadConfig();
  const agentId = nanoid(12);
  const token = generateToken();
  const agentName =
    customName ??
    (agentType in KNOWN_AGENTS
      ? KNOWN_AGENTS[agentType as KnownAgent].name
      : agentType);

  const agent: AgentToken = {
    agentId,
    agentName,
    token,
    memoryFile: `${agentId}.memory`,
    createdAt: new Date().toISOString(),
  };

  // Initialize empty memory file
  initMemoryFile(agentId);

  config.agents.push(agent);
  saveConfig(config);

  return agent;
}

export function getAgentByToken(token: string): AgentToken | undefined {
  const config = loadConfig();
  return config.agents.find((a) => a.token === token);
}

export function updateAgentLastSeen(agentId: string): void {
  const config = loadConfig();
  const agent = config.agents.find((a) => a.agentId === agentId);
  if (agent) {
    agent.lastSeen = new Date().toISOString();
    saveConfig(config);
  }
}

export function revokeAgent(agentId: string): boolean {
  const config = loadConfig();
  const idx = config.agents.findIndex((a) => a.agentId === agentId);
  if (idx === -1) return false;

  const memPath = getMemoryPath(agentId);
  if (fs.existsSync(memPath)) fs.unlinkSync(memPath);

  config.agents.splice(idx, 1);
  saveConfig(config);
  return true;
}

// ─── Universal Memory Management ──────────────────────────────────────────────

export function createUniversalMemory(memoryName: string): UniversalMemory {
  ensureMemlinkDir();
  const config = loadConfig();

  // Ensure universalMemories array exists (for backward compatibility)
  if (!config.universalMemories) {
    config.universalMemories = [];
  }

  const memoryId = nanoid(12);
  const memory: UniversalMemory = {
    memoryId,
    memoryName,
    token: generateToken(),
    memoryFile: `${memoryId}.memory.md`,
    createdAt: new Date().toISOString(),
  };

  config.universalMemories.push(memory);
  saveConfig(config);

  initMemoryFile(memoryId);

  return memory;
}

export function getUniversalMemoryByToken(token: string): UniversalMemory | undefined {
  const config = loadConfig();
  return config.universalMemories.find((m) => m.token === token);
}

export function getUniversalMemoryById(memoryId: string): UniversalMemory | undefined {
  const config = loadConfig();
  return config.universalMemories.find((m) => m.memoryId === memoryId);
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

  config.universalMemories.splice(idx, 1);
  saveConfig(config);
  return true;
}

export function listUniversalMemories(): UniversalMemory[] {
  const config = loadConfig();
  return config.universalMemories;
}

// ─── Memory file format ──────────────────────────────────────────────────────
//
//  Line 1:  # INDEX
//  Lines 2…N:  <title> | <startLine>-<endLine> | <tags> | <updatedAt>
//  Line N+1: # END_INDEX
//  Line N+2: (blank)
//  Then each block:
//    ## <TITLE>
//    <content lines...>
//    ## END_<TITLE>
//    (blank)
//
// ────────────────────────────────────────────────────────────────────────────

const INDEX_START = "# INDEX";
const INDEX_END = "# END_INDEX";

export function initMemoryFile(memoryId: string): void {
  const memPath = getMemoryPath(memoryId);
  if (!fs.existsSync(memPath)) {
    const now = new Date().toISOString();
    const content = [
      INDEX_START,
      `# Memlink Memory — ID: ${memoryId}`,
      `# Created: ${now}`,
      `# Updated: ${now}`,
      INDEX_END,
      "",
    ].join("\n");
    fs.writeFileSync(memPath, content, "utf-8");
  }
}

export function parseMemoryFile(memoryId: string): {
  index: MemoryIndex;
  entries: MemoryEntry[];
} {
  const memPath = getMemoryPath(memoryId);
  if (!fs.existsSync(memPath)) {
    throw new Error(`Memory file not found: ${memoryId}`);
  }

  const raw = fs.readFileSync(memPath, "utf-8");
  const lines = raw.split("\n");

  // Parse INDEX section
  const index: MemoryIndex = {
    version: MEMLINK_VERSION,
    memoryId,
    memoryName: "",
    createdAt: "",
    updatedAt: "",
    entries: [],
  };

  let inIndex = false;
  let contentStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "# INDEX") {
      inIndex = true;
      continue;
    }
    if (line === "# END_INDEX") {
      contentStartLine = i + 1;
      break;
    }
    if (!inIndex) continue;

    if (line.startsWith("# Memlink Memory")) {
      const match = line.match(/ID: ([^)]+)/);
      if (match) {
        index.memoryId = match[1].trim();
      }
    } else if (line.startsWith("# Created:")) {
      index.createdAt = line.replace("# Created:", "").trim();
    } else if (line.startsWith("# Updated:")) {
      index.updatedAt = line.replace("# Updated:", "").trim();
    } else if (line && !line.startsWith("#") && line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 3) {
        const [title, lineRange, tags] = parts;
        const [start, end] = lineRange.split("-").map(Number);
        index.entries.push({
          title,
          startLine: start,
          endLine: end,
          tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
          updatedAt: index.updatedAt,
        });
      }
    }
  }

  // Parse entries with numbered lines
  const entries: MemoryEntry[] = [];
  for (const idxEntry of index.entries) {
    // Adjust line numbers to be relative to content start
    const absoluteStart = contentStartLine + idxEntry.startLine;
    const absoluteEnd = contentStartLine + idxEntry.endLine + 1;
    const contentLines = lines.slice(absoluteStart, absoluteEnd);
    const content = contentLines
      .map((line) => {
        const match = line.match(/^\d+:\s*(.*)$/);
        return match ? match[1] : line;
      })
      .join("\n");
    
    entries.push({
      title: idxEntry.title,
      content,
      startLine: idxEntry.startLine,
      endLine: idxEntry.endLine,
      tags: idxEntry.tags,
      updatedAt: idxEntry.updatedAt,
    });
  }

  return { index, entries };
}

export function writeMemoryFile(
  memoryId: string,
  entries: MemoryEntry[]
): void {
  const memPath = getMemoryPath(memoryId);
  const now = new Date().toISOString();

  const lines: string[] = [];

  // INDEX section
  lines.push(INDEX_START);
  lines.push(`# Memlink Memory — ID: ${memoryId}`);
  lines.push(`# Created: ${now}`);
  lines.push(`# Updated: ${now}`);

  // Build content with numbered lines
  const contentLines: string[] = [];
  const indexEntryLines: string[] = [];
  let currentLine = 1;

  for (const entry of entries) {
    const startLine = currentLine;
    const entryContentLines = entry.content.split("\n");
    
    // Add numbered lines for this entry
    for (const contentLine of entryContentLines) {
      contentLines.push(`${currentLine}: ${contentLine}`);
      currentLine++;
    }
    
    const endLine = currentLine - 1;
    const tags = Array.isArray(entry.tags) ? entry.tags.join(",") : "";
    entry.updatedAt = entry.updatedAt || now;
    
    indexEntryLines.push(`${entry.title} | ${startLine}-${endLine} | ${tags}`);
    
    // Add blank line between entries
    contentLines.push("");
    currentLine++;
  }

    // Add index entries to lines
  lines.push(...indexEntryLines);
  lines.push(INDEX_END);
  lines.push("");
  
  // Add content lines
  lines.push(...contentLines);

  fs.writeFileSync(memPath, lines.join("\n"), "utf-8");
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

export function readMemory(memoryId: string): MemoryEntry[] {
  const { entries } = parseMemoryFile(memoryId);
  return entries;
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
  const entries = readMemory(memoryId);
  const now = new Date().toISOString();
  const existing = entries.findIndex((e) => e.title.toLowerCase() === title.toLowerCase());

  const entry: MemoryEntry = {
    title,
    content,
    startLine: 0,
    endLine: 0,
    tags,
    updatedAt: now,
  };

  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }

  writeMemoryFile(memoryId, entries);

  return entry;
}

export function deleteMemoryEntry(memoryId: string, title: string): boolean {
  const entries = readMemory(memoryId);
  const idx = entries.findIndex((e) => e.title.toLowerCase() === title.toLowerCase());
  if (idx === -1) return false;

  entries.splice(idx, 1);
  writeMemoryFile(memoryId, entries);
  return true;
}

export function syncMemory(memoryId: string): { entries: number; size: number } {
  const memPath = getMemoryPath(memoryId);
  if (!fs.existsSync(memPath)) throw new Error("Memory file not found");

  const { entries } = parseMemoryFile(memoryId);
  const stats = fs.statSync(memPath);

  return {
    entries: entries.length,
    size: stats.size,
  };
}

// ─── Search memory ────────────────────────────────────────────────────────────

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

// ─── Export/Import memory ──────────────────────────────────────────────────────

export interface MemoryIndex {
  version: string;
  memoryId: string;
  memoryName: string;
  createdAt: string;
  updatedAt: string;
  entries: MemoryIndexEntry[];
}

export interface MemoryExport {
  version: string;
  exportedAt: string;
  memoryId: string;
  memoryName?: string;
  entries: MemoryEntry[];
}

export function exportMemory(memoryId: string): MemoryExport {
  const config = loadConfig();
  const memory = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const { entries } = parseMemoryFile(memoryId);

  return {
    version: MEMLINK_VERSION,
    exportedAt: new Date().toISOString(),
    memoryId,
    memoryName: memory.memoryName,
    entries,
  };
}

export function importMemory(memoryId: string, data: MemoryExport): number {
  const config = loadConfig();
  const memory = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  // Merge with existing entries
  const existing = readMemory(memoryId);
  const merged = new Map<string, MemoryEntry>();

  // Add existing entries first
  for (const entry of existing) {
    merged.set(entry.title.toLowerCase(), entry);
  }

  // Add/overwrite with imported entries
  for (const entry of data.entries) {
    merged.set(entry.title.toLowerCase(), {
      ...entry,
      updatedAt: new Date().toISOString(),
    });
  }

  writeMemoryFile(memoryId, Array.from(merged.values()));

  return data.entries.length;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

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

export function getStats(memoryId: string): MemoryStats {
  const config = loadConfig();
  const memory = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const { entries } = parseMemoryFile(memoryId);
  const stats = syncMemory(memoryId);

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

export interface DetailedMemoryStats extends MemoryStats {
  tagDistribution: Array<{ tag: string; count: number; size: number }>;
  entrySizeDistribution: Array<{ range: string; count: number }>;
  activityTimeline: Array<{ date: string; entries: number }>;
  largestEntries: Array<{ title: string; size: number; tags: string[] }>;
  averageEntrySize: number;
  memoryEfficiency: number;
  growthRate: number;
}

export function getDetailedStats(memoryId: string): DetailedMemoryStats {
  const basicStats = getStats(memoryId);
  const { entries } = parseMemoryFile(memoryId);
  
  // Tag distribution
  const tagMap = new Map<string, { count: number; size: number }>();
  for (const entry of entries) {
    if (entry.tags) {
      const entrySize = JSON.stringify(entry).length;
      for (const tag of entry.tags) {
        const existing = tagMap.get(tag) || { count: 0, size: 0 };
        tagMap.set(tag, {
          count: existing.count + 1,
          size: existing.size + entrySize
        });
      }
    }
  }
  
  const tagDistribution = Array.from(tagMap.entries())
    .map(([tag, data]) => ({ tag, ...data }))
    .sort((a, b) => b.count - a.count);
  
  // Entry size distribution
  const sizes = entries.map(e => JSON.stringify(e).length);
  const sizeRanges = [
    { range: '0-1KB', min: 0, max: 1024 },
    { range: '1-5KB', min: 1024, max: 5120 },
    { range: '5-10KB', min: 5120, max: 10240 },
    { range: '10-50KB', min: 10240, max: 51200 },
    { range: '50KB+', min: 51200, max: Infinity }
  ];
  
  const entrySizeDistribution = sizeRanges.map(range => ({
    range: range.range,
    count: sizes.filter(s => s >= range.min && s < range.max).length
  }));
  
  // Activity timeline (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const activityMap = new Map<string, number>();
  for (const entry of entries) {
    const entryDate = new Date(entry.updatedAt).toISOString().split('T')[0];
    if (new Date(entry.updatedAt) >= thirtyDaysAgo) {
      activityMap.set(entryDate, (activityMap.get(entryDate) || 0) + 1);
    }
  }
  
  const activityTimeline = Array.from(activityMap.entries())
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Largest entries
  const largestEntries = entries
    .map(entry => ({
      title: entry.title,
      size: JSON.stringify(entry).length,
      tags: entry.tags || []
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  // Additional metrics
  const totalEntrySize = sizes.reduce((sum, size) => sum + size, 0);
  const averageEntrySize = entries.length > 0 ? totalEntrySize / entries.length : 0;
  
  // Memory efficiency (ratio of actual content to JSON overhead)
  const contentSize = entries.reduce((sum, entry) => 
    sum + (entry.title.length + entry.content.length), 0);
  const memoryEfficiency = totalEntrySize > 0 ? contentSize / totalEntrySize : 0;
  
  // Growth rate (entries per day over last 30 days)
  const daysSinceCreation = Math.max(1, Math.floor((Date.now() - new Date(basicStats.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  const growthRate = entries.length / daysSinceCreation;
  
  return {
    ...basicStats,
    tagDistribution,
    entrySizeDistribution,
    activityTimeline,
    largestEntries,
    averageEntrySize,
    memoryEfficiency,
    growthRate
  };
}

export function getAllMemoriesStats(): Array<DetailedMemoryStats> {
  const config = loadConfig();
  return config.universalMemories.map(memory => 
    getDetailedStats(memory.memoryId)
  );
}

// ─── Token rotation ───────────────────────────────────────────────────────────

export function rotateToken(memoryId: string): string {
  const config = loadConfig();
  const memory = config.universalMemories.find((m) => m.memoryId === memoryId);
  if (!memory) throw new Error(`Memory not found: ${memoryId}`);

  const newToken = generateToken();
  memory.token = newToken;
  memory.lastSeen = new Date().toISOString();
  saveConfig(config);

  return newToken;
}

// ─── Bulk Delete Operations ───────────────────────────────────────────────────────

export function bulkDeleteMemories(
  memoryId: string,
  titles: string[]
): { deleted: number; notFound: string[] } {
  const entries = readMemory(memoryId);
  const titlesToDeleteLower = titles.map(t => t.toLowerCase());
  
  const deletedEntries = entries.filter(
    (e) => titlesToDeleteLower.includes(e.title.toLowerCase())
  );
  const remainingEntries = entries.filter(
    (e) => !titlesToDeleteLower.includes(e.title.toLowerCase())
  );

  writeMemoryFile(memoryId, remainingEntries);
  
  return {
    deleted: deletedEntries.length,
    notFound: titles.filter(title => 
      !entries.some(e => e.title.toLowerCase() === title.toLowerCase())
    )
  };
}

export function bulkDeleteMemoriesByTags(
  memoryId: string,
  tags: string[]
): { deleted: number; entries: MemoryEntry[] } {
  const entries = readMemory(memoryId);
  const tagsToDeleteLower = tags.map(t => t.toLowerCase());
  
  const deletedEntries = entries.filter(
    (entry) => entry.tags?.some(tag => tagsToDeleteLower.includes(tag.toLowerCase()))
  );
  
  const remainingEntries = entries.filter(
    (entry) => !entry.tags?.some(tag => tagsToDeleteLower.includes(tag.toLowerCase()))
  );

  writeMemoryFile(memoryId, remainingEntries);
  
  return {
    deleted: deletedEntries.length,
    entries: deletedEntries
  };
}

export function bulkDeleteMemoriesByPattern(
  memoryId: string,
  pattern: string,
  useRegex: boolean = false
): { deleted: number; entries: MemoryEntry[] } {
  const entries = readMemory(memoryId);
  let deletedEntries: MemoryEntry[] = [];

  if (useRegex) {
    try {
      // Sanitize regex pattern to prevent ReDoS attacks
      const sanitizedPattern = pattern
        .replace(/[+*()[\]{}|.^$?\\]/g, '\\$&') // Escape special regex chars
        .replace(/\\+/g, '+') // Allow escaped plus
        .replace(/\\\*/g, '*') // Allow escaped asterisk
        .replace(/\\\?/g, '?'); // Allow escaped question mark
      const regex = new RegExp(sanitizedPattern, 'i');
      deletedEntries = entries.filter(
        (entry) => regex.test(entry.title) || regex.test(entry.content)
      );
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${error}`);
    }
  } else {
    const patternLower = pattern.toLowerCase();
    deletedEntries = entries.filter(
      (entry) => 
        entry.title.toLowerCase().includes(patternLower) ||
        entry.content.toLowerCase().includes(patternLower)
    );
  }

  const remainingEntries = entries.filter(
    (entry) => !deletedEntries.includes(entry)
  );

  writeMemoryFile(memoryId, remainingEntries);
  
  return {
    deleted: deletedEntries.length,
    entries: deletedEntries
  };
}

// ─── Backup & Restore ───────────────────────────────────────────────────────────

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

export function createBackup(
  memoryId: string,
  includeDeleted: boolean = false
): MemoryBackup {
  const entries = readMemory(memoryId);
  const filteredEntries = includeDeleted ? entries : entries.filter(e => !e.title.startsWith('_DELETED_'));
  
  // Calculate statistics
  const allTags = filteredEntries.flatMap(e => e.tags || []);
  const uniqueTags = Array.from(new Set(allTags));
  const totalSize = JSON.stringify(filteredEntries).length;
  
  // Create checksum
  const checksum = generateId(); // Simple checksum for now
  
  const metadata: BackupMetadata = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    memoryId,
    entryCount: filteredEntries.length,
    totalSize,
    tags: uniqueTags,
    checksum
  };

  return {
    metadata,
    entries: filteredEntries
  };
}

export function saveBackup(
  memoryId: string,
  backupPath?: string
): string {
  const backup = createBackup(memoryId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = backupPath || `${getMemlinkDir()}/backups/${memoryId}_${timestamp}.json`;
  
  // Ensure backup directory exists
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
  overwrite: boolean = false
): { restored: number; memoryId: string } {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const backup: MemoryBackup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const memoryId = targetMemoryId || backup.metadata.memoryId;
  
  // Check if memory exists
  const memoryExists = fs.existsSync(`${getMemlinkDir()}/${memoryId}.memory.md`);
  
  if (memoryExists && !overwrite) {
    throw new Error(`Memory "${memoryId}" already exists. Use overwrite=true to replace it.`);
  }
  
  // Initialize memory if it doesn't exist
  if (!memoryExists) {
    initMemoryFile(memoryId);
  }
  
  // Restore entries
  writeMemoryFile(memoryId, backup.entries);
  
  return {
    restored: backup.entries.length,
    memoryId
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
  
  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json'))
    .filter(file => !memoryId || file.includes(memoryId))
    .map(file => {
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
          entryCount: backup.metadata.entryCount
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<any>;
  
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
  keepCount: number = 10
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
    kept: backups.length - deleted
  };
}
