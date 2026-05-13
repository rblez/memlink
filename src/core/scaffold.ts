import fs from "fs";
import path from "path";
import os from "os";
import { homedir } from "os";

export interface AgentConfig {
  id: string;
  name: string;
  mcpGlobal: string;
  mcpProject: string;
  skillGlobal: string;
  skillProject: string;
  hasSkill: boolean;
  supportsAgents: boolean;
}

export const SUPPORTED_AGENTS: AgentConfig[] = [
  {
    id: "windsurf",
    name: "Windsurf",
    mcpGlobal: path.join(homedir(), ".codeium/windsurf/mcp_config.json"),
    mcpProject: ".windsurf/mcp.json",
    skillGlobal: path.join(homedir(), ".codeium/windsurf/skills"),
    skillProject: ".windsurf/skills",
    hasSkill: true,
    supportsAgents: true,
  },
  {
    id: "cursor",
    name: "Cursor",
    mcpGlobal: path.join(homedir(), ".cursor/mcp.json"),
    mcpProject: ".cursor/mcp.json",
    skillGlobal: path.join(homedir(), ".cursor/skills"),
    skillProject: ".cursor/skills",
    hasSkill: true,
    supportsAgents: true,
  },
  {
    id: "claude",
    name: "Claude Code",
    mcpGlobal: path.join(homedir(), ".claude.json"),
    mcpProject: ".mcp.json",
    skillGlobal: path.join(homedir(), ".claude/skills"),
    skillProject: ".claude/skills",
    hasSkill: true,
    supportsAgents: true,
  },
  {
    id: "codex",
    name: "Codex",
    mcpGlobal: path.join(homedir(), ".codex/mcp.json"),
    mcpProject: ".codex/mcp.json",
    skillGlobal: "",
    skillProject: "",
    hasSkill: false,
    supportsAgents: false,
  },
  {
    id: "opencode",
    name: "OpenCode",
    mcpGlobal: path.join(homedir(), ".config/opencode/opencode.json"),
    mcpProject: "opencode.json",
    skillGlobal: path.join(homedir(), ".config/opencode/skills"),
    skillProject: ".opencode/skills",
    hasSkill: true,
    supportsAgents: true,
  },
  {
    id: "devin",
    name: "Devin",
    mcpGlobal: path.join(homedir(), ".devin/mcp.json"),
    mcpProject: ".devin/mcp.json",
    skillGlobal: path.join(homedir(), ".devin/skills"),
    skillProject: ".devin/skills",
    hasSkill: true,
    supportsAgents: true,
  },
];

function ensureDir(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
    return null;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, data: unknown): boolean {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function mergeMcpServers(
  existing: Record<string, unknown> | null,
  newServer: Record<string, unknown>
): Record<string, unknown> {
  if (!existing) {
    return { mcpServers: newServer };
  }
  return {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers as Record<string, unknown>),
      ...newServer,
    },
  };
}

export function scaffoldMcpConfig(
  agent: AgentConfig,
  scope: "global" | "workspace",
  memoryId: string,
  host: string,
  port: number
): boolean {
  const configPath = scope === "global" ? agent.mcpGlobal : agent.mcpProject;
  if (!configPath) return false;

  const mcpConfig = {
    memlink: {
      url: `http://${host}:${port}/mcp?mem_id=${memoryId}`,
    },
  };

  const existing = readJsonFile<Record<string, unknown>>(configPath);
  const merged = mergeMcpServers(existing, mcpConfig);
  return writeJsonFile(configPath, merged);
}

export function scaffoldSkill(
  agent: AgentConfig,
  scope: "global" | "workspace",
  memoryId: string,
  memoryName: string,
  description: string
): boolean {
  const skillPath = scope === "global" ? agent.skillGlobal : agent.skillProject;
  if (!skillPath || !agent.hasSkill) return false;

  const skillDir = path.join(skillPath, `memlink-${memoryName.toLowerCase().replace(/\s+/g, "-")}`);
  const skillFile = path.join(skillDir, "SKILL.md");

  if (!ensureDir(skillDir)) return false;

  const skillContent = `---
name: memlink-${memoryName.toLowerCase().replace(/\s+/g, "-")}
description: Acceso a memoria ${memoryName} de Memlink - ${description}
---

# Memoria: ${memoryName}

Esta memoria contiene información de ${description || "propósito general"}.

## Uso

El agente tiene acceso a herramientas MCP de Memlink:
- memory_read: Leer entradas de memoria
- memory_edit: Editar entradas existentes
- memory_search: Buscar en la memoria por keywords

## Formato de la memoria

Las entradas están indexadas con números. Cada entrada tiene:
- Un título
- Contenido descriptivo
- Tags opcionales para categorización

## Ejemplos

- "Lee la memoria sobre el proyecto"
- "Busca en la memoria información sobre la arquitectura"
- "Actualiza la memoria con nuevos requisitos"
`;

  try {
    fs.writeFileSync(skillFile, skillContent, "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function scaffoldAgentsMd(
  scope: "global" | "workspace",
  memoryId: string,
  memoryName: string,
  host: string,
  port: number
): boolean {
  const agentsMdPath = scope === "global"
    ? path.join(homedir(), ".agents/skills/memlink.md")
    : path.join(process.cwd(), "AGENTS.md");

  const content = `# Project Guidelines

## MCP Servers

Este proyecto usa Memlink para memoria persistente.

### memlink-${memoryName.toLowerCase().replace(/\s+/g, "-")}
- URL: http://${host}:${port}/mcp?mem_id=${memoryId}
- Descripción: ${memoryName}

## Memlink

Memlink es un servidor MCP que proporciona:
- Lectura de memoria persistente
- Edición de entradas de memoria
- Búsqueda en memoria por keywords

Usa las herramientas MCP de Memlink para acceder a la información almacenada.
`;

  try {
    ensureDir(path.dirname(agentsMdPath));
    fs.writeFileSync(agentsMdPath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return SUPPORTED_AGENTS.find((a) => a.id === agentId);
}