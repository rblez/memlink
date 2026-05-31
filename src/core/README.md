# Core

Business logic for memory management, configuration, and data persistence.

## Files

### `types.ts`

TypeScript interfaces and constants.

#### Types

```typescript
interface MemoryEntry {
  id?: number;
  title: string;
  content: string;
  tags?: string[];
  updatedAt: string;
}

interface StorageEntry {
  id: number;
  title: string;
  content: string;
  tags?: string[];
  updatedAt: string;
}

interface StorageIndex {
  memoryName: string;
  memoryId: string;
  nextId: number;
  entries: Array<{ id: number; title: string; tags?: string[]; updatedAt: string }>;
}

interface LockFile {
  pid: number;
  hostname: string;
  lockedAt: number;
}

interface UniversalMemory {
  memoryId: string;
  memoryName: string;
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
| `MEMLINK_VERSION` | `"1.0.11"` |
| `DEFAULT_PORT` | `4444` |
| `DEFAULT_HOST` | `"localhost"` |
| `CONFIG_DIR` | `".memlink"` |
| `CONFIG_FILE` | `"settings.json"` |
| `LOCK_TTL` | `10000` |

### `getMemlinkDir()`

Returns `$MEMLINK_DIR` or `~/.memlink`.

### `memory.ts`

Legacy memory operations (kept for backward compat during migration). New code uses `storage.ts`.

| Function | Description |
|----------|-------------|
| `loadConfig()` | Load `~/.memlink/settings.json` |
| `saveConfig(config)` | Save config to disk (atomic write) |
| `createUniversalMemory(name)` | Create new memory |
| `readMemory(memoryId)` | Read all entries (legacy format) |
| `exportMemoryFormats(memoryId)` | Export memory as JSON only |

### `storage.ts`

New storage system — each memory gets its own directory with per-entry files.

#### Functions

| Function | Description |
|----------|-------------|
| `readIndex(memoryName)` | `index.json` (titles + tags + dates, no content) |
| `readEntry(memoryName, id)` | Single entry by ID |
| `findEntryByTitle(memoryName, title)` | Find entry by title |
| `createEntry(memoryName, memoryId, title, content, tags?)` | Create or update (upserts by title) |
| `readAllEntries(memoryName)` | All entries with content |
| `searchEntries(memoryName, query)` | Search titles first, then content |
| `getStorageStats(memoryName)` | Entry count + last update |
| `migrateLegacyFile(memoryId, memoryName)` | Convert old `.memory.json` to new format |

### `lock.ts`

File-based mutex for write operations. Uses exclusive file create (`wx`) + TTL.

| Function | Description |
|----------|-------------|
| `acquireLock(memoryDir)` | Blocking (up to 5s), returns true/false |
| `releaseLock(memoryDir)` | Release if owned by this PID |
| `withLock(memoryDir, fn)` | Acquire → execute → release, or throw |
| `isLocked(memoryDir)` | Check if lock is held (non-stale) |

## Data Storage

```
~/.memlink/
├── settings.json              # Global config (renamed from config.json)
├── .serve.pid                 # Daemon PID file (hidden)
│
├── test-memory/               # Directory per memory
│   ├── .lock                  # Write lock (hidden)
│   ├── index.json             # Index (titles only)
│   ├── 1.json                 # Entry 1 (with content)
│   ├── 2.json                 # Entry 2
│   │
│   └── .backups/              # Auto-backups on every edit
│       ├── 1_1717112345.json
│       └── index_1717112355.json
│
└── otra-memoria/
    └── ...
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MEMLINK_DIR` | Override data directory (default: `~/.memlink`) |

## Robustness

- **Atomic writes**: all file writes use `.tmp` + `fs.renameSync()`. Eliminates corruption risk on crash.
- **Auto-backups**: every `createEntry` / `updateEntry` creates a timestamped backup in `.backups/`.
- **File lock**: concurrent writes from multiple agents are serialized via `.lock` with 10s TTL + retry.
