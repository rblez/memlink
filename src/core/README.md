# Core

Business logic for memory management, configuration, and data persistence.

## Files

### `memory.ts`

Memory operations and configuration management. The heart of memlink's data layer.

#### Configuration

| Function | Description |
|----------|-------------|
| `loadConfig()` | Load `~/.memlink/config.json` |
| `saveConfig(config)` | Save config to disk |
| `getMemlinkDir()` | Get `~/.memlink/` path |
| `ensureMemlinkDir()` | Create dir if not exists |

#### Universal Memory

| Function | Description |
|----------|-------------|
| `createUniversalMemory(name)` | Create new memory, returns `{memoryId, memoryName, memoryFile}` |
| `readMemory(memoryId)` | Read all entries from memory file |
| `readMemoryEntry(memoryId, title)` | Read specific entry by title |
| `upsertMemoryEntry(memoryId, title, content, tags?)` | Create or update entry |
| `deleteMemoryEntry(memoryId, title)` | Delete entry by title |
| `searchMemory(memoryId, query)` | Search by title, content, or tags |
| `getStats(memoryId)` | Get entry count + file size |

#### Render

| Function | Description |
|----------|-------------|
| `renderMemoryAsMarkdown(memoryId)` | Full memory as markdown |
| `renderEntryAsMarkdown(entry)` | Single entry as markdown |

#### Backup

| Function | Description |
|----------|-------------|
| `createBackup(memoryId)` | Create timestamped backup |
| `listBackups(memoryId)` | List all backups |
| `restoreBackup(memoryId, backupFile)` | Restore from backup |
| `deleteBackup(memoryId, backupFile)` | Delete a backup |
| `cleanupBackups(memoryId, keep)` | Remove old backups |

#### Bulk Operations

| Function | Description |
|----------|-------------|
| `bulkUpsert(memoryId, entries)` | Create/update multiple entries |
| `bulkDeleteByTitles(memoryId, titles)` | Delete by title list |
| `bulkDeleteByTags(memoryId, tags)` | Delete entries matching tags |
| `bulkDeleteByPattern(memoryId, pattern)` | Delete entries matching regex |

#### Export/Import

| Function | Description |
|----------|-------------|
| `exportMemory(memoryId)` | Export to JSON |
| `importMemory(memoryId, data)` | Import from JSON |

### `types.ts`

TypeScript interfaces and constants.

#### Types

```typescript
interface MemoryEntry {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
  tags?: string[];
  updatedAt: string;
}

interface UniversalMemory {
  memoryId: string;
  memoryName: string;
  memoryFile: string;
  createdAt: string;
  lastSeen?: string;
}

interface MemlinkConfig {
  version: string;
  baseDir: string;
  universalMemories: UniversalMemory[];
  serverPort: number;
  serverHost: string;
}
```

#### Constants

| Constant | Value |
|----------|-------|
| `MEMLINK_VERSION` | `"0.5.0"` |
| `DEFAULT_PORT` | `4444` |
| `DEFAULT_HOST` | `"localhost"` |
| `CONFIG_DIR` | `".memlink"` |
| `CONFIG_FILE` | `"config.json"` |

### `scaffold.ts`

Agent configs and skill scaffolding.

- Generates MCP config JSON for agents
- Writes `SKILL.md` + `README.md` to `~/.agents/skills/memlink/`
- Supports 6 agents: windsurf, cursor, claude, codex, opencode, devin

## Data Storage

```
~/.memlink/
├── config.json              # Global config
└── vaJBhSjFY0Zn.memory.json # Universal memory (JSON)
```

Memory files are JSON (not markdown), with entries stored as an array:

```json
{
  "version": "0.5.0",
  "memoryName": "my-project",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "entries": [
    {
      "title": "ProjectContext",
      "content": "...",
      "tags": ["context"],
      "updatedAt": "2024-01-15T10:05:00.000Z"
    }
  ]
}
```

## Usage

```typescript
import {
  loadConfig,
  createUniversalMemory,
  readMemory,
  upsertMemoryEntry,
  searchMemory,
} from './core/memory.ts';

const config = loadConfig();
const memory = createUniversalMemory('my-project');
const entries = readMemory(memory.memoryId);
upsertMemoryEntry(memory.memoryId, 'ProjectContext', 'Content...', ['context']);
const results = searchMemory(memory.memoryId, 'project');
```

## Error Handling

- File not found → create new file
- Invalid JSON → throw error
- Missing directory → create directory
- Memory not found → throw error
