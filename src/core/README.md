# Core

Business logic for memory management, configuration, and data persistence.

## Files

### `memory.ts`

Memory operations and configuration management. The heart of memlink's data layer.

#### Configuration

| Function | Description |
|----------|-------------|
| `loadConfig()` | Load `~/.memlink/config.json` (or `$MEMLINK_DIR/config.json`) |
| `saveConfig(config)` | Save config to disk (atomic write) |
| `getMemlinkDir()` | Get data directory path (`$MEMLINK_DIR` or `~/.memlink`) |
| `ensureMemlinkDir()` | Create dir if not exists |

#### Universal Memory

| Function | Description |
|----------|-------------|
| `createUniversalMemory(name)` | Create new memory, returns `{memoryId, memoryName, memoryFile}` |
| `readMemory(memoryId)` | Read all entries from memory file |
| `readMemoryEntry(memoryId, title)` | Read specific entry by title |
| `upsertMemoryEntry(memoryId, title, content, tags?)` | Create or update entry (auto-backup) |
| `deleteMemoryEntry(memoryId, title)` | Delete entry by title (auto-backup) |
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
| `saveBackup(memoryId)` | Create timestamped backup (atomic write) |
| `listBackups(memoryId)` | List all backups |
| `restoreBackup(memoryId, backupFile)` | Restore from backup |
| `deleteBackup(memoryId, backupFile)` | Delete a backup |
| `cleanupOldBackups(memoryId, keepCount)` | Remove old backups (default keep 3) |

Auto-backups: `upsertMemoryEntry` and `deleteMemoryEntry` automatically call `saveBackup` + `cleanupOldBackups(memoryId, 3)` after each mutation.

#### Bulk Operations

| Function | Description |
|----------|-------------|
| `bulkDeleteMemories(memoryId, titles)` | Delete by title list |
| `bulkDeleteMemoriesByTags(memoryId, tags)` | Delete entries matching tags |
| `bulkDeleteMemoriesByPattern(memoryId, pattern)` | Delete entries matching pattern |

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
  cors?: string;
  readOnly?: boolean;
}
```

#### Constants

| Constant | Value |
|----------|-------|
| `MEMLINK_VERSION` | `"1.0.8"` |
| `DEFAULT_PORT` | `4444` |
| `DEFAULT_HOST` | `"localhost"` |
| `CONFIG_DIR` | `".memlink"` |
| `CONFIG_FILE` | `"config.json"` |

## Data Storage

```
~/.memlink/
├── config.json              # Global config
├── backups/                 # Auto-backups (keeps last 3)
└── abc123def456.memory.json # Universal memory (JSON)
```

Memory files are JSON with entries stored as an array:

```json
{
  "version": "1.0.8",
  "memoryId": "abc123def456",
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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MEMLINK_DIR` | Override data directory (default: `~/.memlink`) |

## Robustness

- **Atomic writes**: all file writes use `writeFileAtomic()` — write to `.tmp` then `fs.renameSync()`. Eliminates corruption risk on crash.
- **Auto-backups**: every `upsertMemoryEntry` and `deleteMemoryEntry` creates a timestamped backup in `backups/`. Only the 3 most recent per memory are kept.
- **Safe clipboard**: clipboard failures in the CLI are caught silently.

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
