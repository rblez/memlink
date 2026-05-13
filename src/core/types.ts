// ─── Memlink Core Types ────────────────────────────────────────────────────────

export interface MemoryEntry {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
  tags?: string[];
  updatedAt: string;
}

export interface MemoryIndex {
  version: string;
  memoryId: string;
  memoryName?: string;
  createdAt: string;
  updatedAt: string;
  entries: MemoryIndexEntry[];
}

export interface MemoryIndexEntry {
  title: string;
  startLine: number;
  endLine: number;
  tags?: string[];
  updatedAt: string;
}

export interface AgentToken {
  agentId: string;
  agentName: string;
  token: string;
  memoryFile: string;
  createdAt: string;
  lastSeen?: string;
}

export interface UniversalMemory {
  memoryId: string;
  memoryName: string;
  token: string;
  memoryFile: string;
  createdAt: string;
  lastSeen?: string;
  linkedAgents?: string[];
}

export interface MemlinkConfig {
  version: string;
  baseDir: string;
  universalMemories: UniversalMemory[];
  agents: AgentToken[]; // Keep for backward compatibility
  serverPort: number;
  serverHost: string;
}

export type KnownAgent = "windsurf" | "cursor" | "claude" | "codex" | "opencode" | "devin";

export interface AgentSkillPaths {
  projectLocal: string;
  global: string;
}

export const KNOWN_AGENTS: Record<KnownAgent, { name: string; description: string; color: string; skillPaths: AgentSkillPaths }> = {
  windsurf: {
    name: "Windsurf",
    description: "Codeium Windsurf AI IDE",
    color: "#00D4FF",
    skillPaths: {
      projectLocal: ".windsurf/skills",
      global: ".codeium/windsurf/skills",
    },
  },
  cursor: {
    name: "Cursor",
    description: "Cursor AI IDE",
    color: "#FF6B6B",
    skillPaths: {
      projectLocal: ".cursor/skills",
      global: ".cursor/skills",
    },
  },
  claude: {
    name: "Claude Code",
    description: "Anthropic Claude Code",
    color: "#CC785C",
    skillPaths: {
      projectLocal: ".claude/skills",
      global: ".claude/skills",
    },
  },
  codex: {
    name: "Codex",
    description: "OpenAI Codex CLI",
    color: "#10A37F",
    skillPaths: {
      projectLocal: ".codex/skills",
      global: ".codex/skills",
    },
  },
  opencode: {
    name: "OpenCode",
    description: "OpenCode AI Agent",
    color: "#6B5B95",
    skillPaths: {
      projectLocal: ".opencode/skills",
      global: ".config/opencode/skills",
    },
  },
  devin: {
    name: "Devin",
    description: "Devin AI Agent",
    color: "#7C3AED",
    skillPaths: {
      projectLocal: ".devin/skills",
      global: ".devin/skills",
    },
  },
};

export const MEMLINK_VERSION = "1.0.0";
export const DEFAULT_PORT = 4444;
export const DEFAULT_HOST = "localhost";
export const CONFIG_DIR = ".memlink";
export const CONFIG_FILE = "config.json";
export const MEMORY_LINES_PER_BLOCK = 50;
