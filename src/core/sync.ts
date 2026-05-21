import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryEntry } from './types.ts';

// ─── Sync Types ──────────────────────────────────────────────────────────────

export interface SyncConfig {
  enabled: boolean;
  direction: 'memlink-to-native' | 'native-to-memlink' | 'bidirectional';
  nativePath: string;
  syncInterval: number; // minutes
  conflictResolution: 'memlink-wins' | 'native-wins' | 'manual';
  lastSync?: string;
}

export interface SyncTarget {
  name: 'windsurf' | 'cursor';
  config: SyncConfig;
  available: boolean;
  lastError?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: number;
  errors: string[];
}

export interface NativeMemory {
  title: string;
  content: string;
  tags?: string[];
  lastModified: string;
}

// ─── Native Memory Detection ─────────────────────────────────────────────────

export function detectNativeMemoryTargets(): SyncTarget[] {
  const targets: SyncTarget[] = [];

  // Detect Windsurf
  const windsurfPath = path.join(os.homedir(), '.windsurf');
  const windsurfMemoryPath = path.join(windsurfPath, 'memory');

  targets.push({
    name: 'windsurf',
    config: {
      enabled: false,
      direction: 'bidirectional',
      nativePath: windsurfMemoryPath,
      syncInterval: 30,
      conflictResolution: 'memlink-wins',
    },
    available: fs.existsSync(windsurfPath),
  });

  // Detect Cursor
  const cursorPath = path.join(os.homedir(), '.cursor');
  const cursorMemoryPath = path.join(cursorPath, 'memory');

  targets.push({
    name: 'cursor',
    config: {
      enabled: false,
      direction: 'memlink-to-native',
      nativePath: cursorMemoryPath,
      syncInterval: 60,
      conflictResolution: 'memlink-wins',
    },
    available: fs.existsSync(cursorPath),
  });

  return targets;
}

export function validateNativeMemoryPath(targetPath: string): boolean {
  try {
    if (!fs.existsSync(targetPath)) {
      return false;
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return false;
    }

    // Check if we can write to this directory
    const testFile = path.join(targetPath, '.memlink-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return true;
  } catch {
    return false;
  }
}

// ─── Format Conversion ───────────────────────────────────────────────────────

export function convertMemlinkToNative(memlinkEntries: MemoryEntry[]): NativeMemory[] {
  return memlinkEntries.map((entry) => ({
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    lastModified: entry.updatedAt,
  }));
}

export function convertNativeToMemlink(nativeMemories: NativeMemory[]): MemoryEntry[] {
  return nativeMemories.map((memory, index) => ({
    title: memory.title,
    content: memory.content,
    tags: memory.tags,
    startLine: index * 20 + 1,
    endLine: (index + 1) * 20,
    updatedAt: memory.lastModified,
  }));
}

// ─── Native Memory Format Writers ─────────────────────────────────────────────

export function writeWindsurfFormat(memories: NativeMemory[], targetPath: string): void {
  const contextDir = path.join(targetPath, 'context');

  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  // Write project context
  const projectContext = memories.find(
    (m) => m.title.toLowerCase().includes('project') || m.title.toLowerCase().includes('context')
  );

  if (projectContext) {
    const projectFile = path.join(contextDir, 'project-context.md');
    const content = formatWindsurfProjectContext(projectContext);
    fs.writeFileSync(projectFile, content);
  }

  // Write user preferences
  const userPrefs = memories.find(
    (m) => m.title.toLowerCase().includes('preference') || m.title.toLowerCase().includes('user')
  );

  if (userPrefs) {
    const prefsFile = path.join(contextDir, 'user-preferences.md');
    const content = formatWindsurfUserPreferences(userPrefs);
    fs.writeFileSync(prefsFile, content);
  }

  // Write other memories as separate files
  memories.forEach((memory) => {
    if (memory !== projectContext && memory !== userPrefs) {
      const fileName =
        memory.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') + '.md';
      const filePath = path.join(contextDir, fileName);
      fs.writeFileSync(filePath, formatWindsurfGeneric(memory));
    }
  });
}

export function writeCursorFormat(memories: NativeMemory[], targetPath: string): void {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  // Write main project memory
  const projectMemories = memories.filter(
    (m) =>
      m.title.toLowerCase().includes('project') ||
      m.title.toLowerCase().includes('context') ||
      m.title.toLowerCase().includes('stack')
  );

  if (projectMemories.length > 0) {
    const projectFile = path.join(targetPath, 'project-memory.md');
    const content = formatCursorProjectMemory(projectMemories);
    fs.writeFileSync(projectFile, content);
  }

  // Write user preferences
  const userPrefs = memories.filter(
    (m) => m.title.toLowerCase().includes('preference') || m.title.toLowerCase().includes('user')
  );

  if (userPrefs.length > 0) {
    const prefsFile = path.join(targetPath, 'user-preferences.md');
    const content = formatCursorUserPreferences(userPrefs);
    fs.writeFileSync(prefsFile, content);
  }
}

// ─── Format Helpers ─────────────────────────────────────────────────────────────

function formatWindsurfProjectContext(memory: NativeMemory): string {
  return `# Project Context

${memory.content}

---

*Last updated: ${new Date(memory.lastModified).toLocaleString()}*
`;
}

function formatWindsurfUserPreferences(memory: NativeMemory): string {
  return `# User Preferences

${memory.content}

---

*Last updated: ${new Date(memory.lastModified).toLocaleString()}*
`;
}

function formatWindsurfGeneric(memory: NativeMemory): string {
  return `# ${memory.title}

${memory.content}

${memory.tags && memory.tags.length > 0 ? `**Tags:** ${memory.tags.join(', ')}\n` : ''}

---

*Last updated: ${new Date(memory.lastModified).toLocaleString()}*
`;
}

function formatCursorProjectMemory(memories: NativeMemory[]): string {
  const sections = memories
    .map(
      (memory) =>
        `## ${memory.title}

${memory.content}`
    )
    .join('\n\n');

  return `# Project Memory

${sections}

---

*Last updated: ${new Date(Math.max(...memories.map((m) => new Date(m.lastModified).getTime()))).toLocaleString()}*
`;
}

function formatCursorUserPreferences(memories: NativeMemory[]): string {
  const sections = memories
    .map(
      (memory) =>
        `## ${memory.title}

${memory.content}`
    )
    .join('\n\n');

  return `# User Preferences

${sections}

---

*Last updated: ${new Date(Math.max(...memories.map((m) => new Date(m.lastModified).getTime()))).toLocaleString()}*
`;
}

// ─── Native Memory Readers ───────────────────────────────────────────────────

export function readWindsurfFormat(targetPath: string): NativeMemory[] {
  const memories: NativeMemory[] = [];
  const contextDir = path.join(targetPath, 'context');

  if (!fs.existsSync(contextDir)) {
    return memories;
  }

  const files = fs.readdirSync(contextDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    try {
      const filePath = path.join(contextDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);

      const memory = parseWindsurfMarkdown(content, stats.mtime.toISOString());
      if (memory) {
        memories.push(memory);
      }
    } catch (error) {
      console.warn(`Failed to read Windsurf memory file ${file}:`, error);
    }
  }

  return memories;
}

export function readCursorFormat(targetPath: string): NativeMemory[] {
  const memories: NativeMemory[] = [];

  if (!fs.existsSync(targetPath)) {
    return memories;
  }

  const files = fs.readdirSync(targetPath).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    try {
      const filePath = path.join(targetPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);

      const memoryList = parseCursorMarkdown(content, stats.mtime.toISOString());
      memories.push(...memoryList);
    } catch (error) {
      console.warn(`Failed to read Cursor memory file ${file}:`, error);
    }
  }

  return memories;
}

// ─── Markdown Parsers ─────────────────────────────────────────────────────────

function parseWindsurfMarkdown(content: string, lastModified: string): NativeMemory | null {
  const lines = content.split('\n');
  const titleMatch = lines[0]?.match(/^#\s+(.+)$/);

  if (!titleMatch) {
    return null;
  }

  const title = titleMatch[1];

  // Remove title and any trailing metadata
  const contentLines = lines.slice(1);
  const lastContentIndex = contentLines.findIndex(
    (line) => line.startsWith('---') || line.startsWith('*Last updated:')
  );

  const cleanContent =
    lastContentIndex >= 0
      ? contentLines.slice(0, lastContentIndex).join('\n').trim()
      : contentLines.join('\n').trim();

  // Extract tags
  const tagsMatch = content.match(/\*\*Tags:\*\*\s*([^\n]+)/);
  const tags = tagsMatch ? tagsMatch[1].split(', ').map((t) => t.trim()) : [];

  return {
    title,
    content: cleanContent,
    tags,
    lastModified,
  };
}

function parseCursorMarkdown(content: string, lastModified: string): NativeMemory[] {
  const memories: NativeMemory[] = [];
  const sections = content.split(/^##\s+/m);

  // Skip the first section (main title)
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    const lines = section.split('\n');
    const title = lines[0]?.trim();

    if (!title) continue;

    const content = lines.slice(1).join('\n').trim();

    // Remove metadata at the end
    const cleanContent = content.replace(/\n\n---\n\n\*Last updated:.*$/, '');

    memories.push({
      title,
      content: cleanContent,
      lastModified,
    });
  }

  return memories;
}
