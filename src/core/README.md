# Core Directory

Core business logic for memory management, configuration, and data persistence.

## Files

### [memory.ts](./memory.ts)

Memory operations and configuration management. This is the heart of memlink's data layer.

**Purpose:**
- Manage memory files (create, read, write, delete)
- Handle agent registration and tokens
- Provide search and export/import functionality
- Manage global configuration

**Key Functions:**

#### Configuration Management
- `loadConfig()` - Load configuration from `~/.memlink/config.json`
- `saveConfig(config)` - Save configuration to disk
- `getMemlinkDir()` - Get memlink directory path (`~/.memlink/`)

#### Agent Management
- `createAgent(agentName, agentType)` - Create new agent with unique token
- `revokeAgent(agentId)` - Revoke agent and delete memory
- `getAgentByToken(token)` - Find agent by bearer token
- `rotateToken(agentId)` - Generate new token for agent

#### Memory Operations
- `readMemory(agentId)` - Read all memory entries for agent
- `readMemoryEntry(agentId, title)` - Read specific entry by title
- `upsertMemoryEntry(agentId, agentName, title, content, tags)` - Create or update entry
- `deleteMemoryEntry(agentId, title)` - Delete entry by title
- `syncMemory(agentId)` - Sync memory file and return stats
- `parseMemoryFile(agentId)` - Parse memory file structure

#### Search and Export
- `searchMemory(agentId, query)` - Search entries by title, content, or tags
- `exportMemory(agentId)` - Export memory to JSON format
- `importMemory(agentId, data)` - Import memory from JSON

#### Statistics
- `getStats(agentId)` - Get detailed memory statistics

#### Utility Functions
- `ensureMemlinkDir()` - Create memlink directory if not exists
- `generateToken()` - Generate unique bearer token (`memlink_<32char>`)

**Memory File Format:**

Memory files use a structured format with index:

```
# INDEX
# memlink Memory — Agent: Windsurf — ID: abc123
# Created: 2024-01-15T10:00:00.000Z
EntryTitle | 6-25 | tags | 2024-01-15T10:05:00.000Z
# END_INDEX

## ENTRYTITLE
Entry content here...
## END_ENTRYTITLE
```

**Configuration Structure:**

```typescript
interface MemlinkConfig {
  serverPort: number;      // Default: 4444
  serverHost: string;      // Default: localhost
  agents: AgentToken[];    // Registered agents
}
```

**Dependencies:**
- `nanoid` - Unique ID generation
- `fs` - File system operations
- `path` - Path utilities
- `os` - OS utilities (homedir)

### [types.ts](./types.ts)

TypeScript type definitions and constants.

**Purpose:**
- Define all TypeScript interfaces and types
- Export constants and configuration values
- Define known agent types

**Key Types:**

#### Memory Types
```typescript
interface MemoryEntry {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
  tags?: string[];
  updatedAt: string;
}

interface MemoryIndex {
  version: string;
  agent: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  entries: MemoryIndexEntry[];
}
```

#### Agent Types
```typescript
interface AgentToken {
  agentId: string;
  agentName: string;
  token: string;
  createdAt: string;
  lastSeen?: string;
  memoryFile: string;
}
```

#### Configuration Types
```typescript
interface MemlinkConfig {
  serverPort?: number;
  serverHost?: string;
  agents: AgentToken[];
}
```

#### Known Agent Types
```typescript
interface KnownAgent {
  name: string;
  description: string;
  color: string;
  skillPaths: {
    projectLocal: string;
    global: string;
  };
}

const KNOWN_AGENTS: Record<string, KnownAgent> = {
  windsurf: { ... },
  cursor: { ... },
  claude: { ... },
  // ... 11 agent types total
};
```

**Constants:**
- `MEMLINK_VERSION` - Current version ("0.4.0")
- `DEFAULT_PORT` - Default server port (4444)
- `DEFAULT_HOST` - Default server host ("localhost")
- `CONFIG_DIR` - Config directory name (".memlink")
- `CONFIG_FILE` - Config file name ("config.json")
- `MEMORY_LINES_PER_BLOCK` - Lines per memory block (50)

**Supported Agent Types:**
1. `windsurf` - Windsurf IDE
2. `cursor` - Cursor IDE
3. `claude` - Claude AI
4. `codex` - OpenAI Codex
5. `goose` - Goose AI
6. `opencode` - OpenCode
7. `kimi` - Kimi AI
8. `qwen` - Qwen AI
9. `copilot` - GitHub Copilot
10. `amp` - Amp AI
11. `custom` - Custom agents

## Usage

```typescript
import {
  loadConfig,
  createAgent,
  readMemory,
  upsertMemoryEntry
} from './core/memory.js';

// Load config
const config = loadConfig();

// Create agent
const agent = createAgent('Windsurf', 'windsurf');

// Read memory
const entries = readMemory(agent.agentId);

// Update memory
upsertMemoryEntry(agent.agentId, 'ProjectContext', 'Content...');
```

## Data Storage

All data is stored in `~/.memlink/`:

```
~/.memlink/
├── config.json           # Global configuration
├── abc123.memory         # Agent memory files
└── xyz789.memory
```

## Error Handling

All functions include error handling:
- File not found → Create new file
- Invalid JSON → Throw error
- Missing directory → Create directory
- Invalid agent → Throw error

## Testing

```bash
# Build
npm run build

# Test memory operations
node -e "const { loadConfig } = require('./dist/core/memory.js'); console.log(loadConfig());"
```
