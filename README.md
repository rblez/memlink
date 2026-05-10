# Memlink

> **Universal Memory for AI Agents. Self-hosted, Fast, Organized.**

Memlink is a self-hosted MCP (Model Context Protocol) server that gives AI agents persistent, organized memory. Each agent gets its own memory file, its own bearer token, and a structured format that stays clean and readable.

## Installation

```bash
curl rblez.com/memlink/install.sh | bash
```

## Features

- Universal memory per agent (via MCP)
- Bearer token authentication
- File-based storage (`.memory.md` format)
- CLI for memory management
- MCP server for agent integration
- Backup and restore
- Auto-update functionality

---

## Important Notice

**This is NOT an official agent memory system.**

Memlink provides **MCP-powered memory**, which means:

- Works via MCP (Model Context Protocol) connection only
- Requires Memlink MCP server to be running
- Agents access memory through MCP tools (`memory_read`, `memory_edit`, etc.)
- Does NOT integrate with agent's native memory folders (`.windsurf/memory`, `.cursor/memory`, etc.)
- Does NOT replace or sync with official agent memory systems

**Why?** Each AI agent has its own proprietary memory format and location. Memlink provides a **universal** alternative that works across all agents via MCP, giving you full control over your data.

**Coming Soon:** We're exploring ways to integrate with native agent memory systems while maintaining universal compatibility. The goal is a true universal memory that works both via MCP and within each agent's native memory folder.

---

## Architecture

```
~/.memlink/
├── config.json              # Global config + agent registry
├── abc123def456.memory.md   # Universal memory
└── xyz789ghi012.memory.md   # Another universal memory
```

Each `.memory.md` file has a clean indexed format:

```
# INDEX
# Memlink Memory — ID: abc123def456
# Created: 2024-01-15T10:00:00.000Z
# Updated: 2024-01-15T10:06:00.000Z
ProjectContext | 1-4 | project,stack
UserPreferences | 6-8 | preferences
# END_INDEX

1: Building a SaaS app with Next.js 14 and Supabase.
2: The project is called "TaskFlow" and targets freelancers.
3: Stack: TypeScript, Next.js, Tailwind, Supabase, Stripe.
4:

6: Prefers concise responses
7: Uses TypeScript strict mode always
8: Tabs, not spaces
```

---

## Install

### Interactive install (recommended)

```bash
curl -sL rblez.com/memlink/install.sh | bash
```

The installer will:
1. Detect your OS and architecture
2. Download the appropriate binary
3. Install to `/usr/local/bin`
4. Run `memlink init` automatically

### Manual install

Download the binary for your platform from [GitHub Releases](https://github.com/rblez/memlink/releases):

```bash
# Linux x64
curl -L -o memlink https://github.com/rblez/memlink/releases/latest/download/memlink-linux-x64
chmod +x memlink
sudo mv memlink /usr/local/bin/
memlink init
```

### Development

```bash
# Clone the repository
git clone https://github.com/rblez/memlink.git
cd memlink

# Install dependencies
bun install

# Build binaries
bun run build:binaries

# Or run directly
bun src/cli/index.ts init
```

---

## Quick Start

```bash
# 1. Initialize
memlink init

# 2. Create a universal memory
memlink memory create my-project

# 3. Start the MCP server
memlink serve
```

The `memory create` command outputs the full MCP config ready to paste into your IDE. Any agent (Windsurf, Cursor, Claude, etc.) can use the same universal memory.

---

## CLI Reference

### Global Options

```bash
memlink --json          # Output in JSON format (for scripting)
memlink -v, --verbose   # Show detailed output
```

### `memlink init`
Initialize Memlink on your system. Creates `~/.memlink/` with default config.

### `memlink serve`
Start the MCP server.

```bash
memlink serve
memlink serve --port 4444 --host localhost
```

### `memlink status`
Show full system status: server URL, all agents, memory stats.

```bash
memlink status
```

### Memory Commands

#### `memlink memory create <name>`
Create a new universal memory and generate a unique bearer token.

```bash
memlink memory create my-project
memlink memory create research-notes
memlink memory create development-log
```

Output includes the full MCP JSON config ready to paste into any IDE or agent.

#### `memlink memory list`
List all universal memories with their IDs, token previews, and last seen.

```bash
memlink memory list
```

#### `memlink memory token <memoryId>`
Show the full token for a universal memory.

```bash
memlink memory token abc123def456
```

#### `memlink memory revoke <memoryId>`
Revoke a universal memory and permanently delete its data.

```bash
memlink memory revoke abc123def456
```

#### `memlink memory rotate <memoryId>`
Rotate the memory's token (generate a new one for security).

```bash
memlink memory rotate abc123def456
```

### Memory Inspection Commands

#### `memlink memory list`
List all memory files with entry counts and sizes.

#### `memlink memory show <memoryId>`
Show the full memory for a universal memory in the CLI.

```bash
memlink memory show abc123def456
memlink memory show abc123def456 --title "ProjectContext"
```

#### `memlink memory search <memoryId> <query>`
Search memory entries by title, content, or tags.

```bash
memlink memory search abc123def456 "project"
```

#### `memlink memory export <memoryId>`
Export memory to JSON for backup.

```bash
memlink memory export abc123def456 -o backup.json
memlink memory export abc123def456  # outputs to stdout
```

#### `memlink memory import <memoryId> <file>`
Import memory from JSON backup.

```bash
memlink memory import abc123def456 backup.json
```

#### `memlink memory stats <memoryId>`
Show detailed memory statistics.

```bash
memlink memory stats abc123def456
```

### Skill Commands

#### `memlink skill install <agentType>`
Install the Memlink skill for an agent type (interactive).

```bash
memlink skill install windsurf
```

#### `memlink skill update <agentType>`
Update the Memlink skill for an agent type.

```bash
memlink skill update windsurf
```

### Config Commands

#### `memlink config`
View or modify Memlink configuration.

```bash
memlink config                    # view current config
memlink config --port 4445        # change port
memlink config --host 0.0.0.0     # change host
```

---

## MCP Server

**URL:** `http://localhost:4444/mcp`

**Auth:** `Authorization: Bearer <token>`

### Tools exposed to agents

| Tool | Description |
|------|-------------|
| `memory_read` | Read all entries or one by title |
| `memory_edit` | Create or update a memory entry |
| `memory_delete` | Delete an entry by title |
| `memory_sync` | Sync and validate memory integrity |
| `memory_search` | Search entries by query (title, content, tags) |
| `memory_batch` | Create/update multiple entries at once |

### Resources

| URI | Description |
|-----|-------------|
| `memlink://instructions` | Agent rules system prompt |
| `memlink://agents` | List all registered agents |

---

## Windsurf Configuration

After running `memlink agent create windsurf`, add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "memlink": {
      "serverUrl": "http://localhost:4444/mcp",
      "headers": {
        "Authorization": "Bearer memlink_YOURTOKEN"
      }
    }
  }
}
```

---

## Agent System Prompt Rules

When an agent connects, it receives rules via `memlink://instructions`:

- Read memory at session start
- Save important information automatically  
- Detect "save X to memory", "remember that", "forget X" commands
- Keep memory organized with consistent titles
- Update existing entries instead of duplicating
- Only knows its own connected memory — no filesystem access needed

---

## Security

- Each agent has a unique `memlink_<32char>` bearer token
- Tokens never expire unless revoked with `memlink agent revoke`
- The server binds to `localhost` by default — not exposed to the network
- Memory files stay local in `~/.memlink/`

---

## Development

```bash
# Run server in dev mode (hot reload)
bun run dev:server

# Run CLI in dev mode
bun src/cli/index.ts status

# Build
bun run build
```

### TypeScript-First Development

This project is 100% TypeScript with Bun for optimal performance:

- **Runtime**: Bun (3x faster than Node.js)
- **Language**: TypeScript only (no JavaScript files)
- **Package Manager**: Bun (built-in, no external deps)
- **TypeScript**: Native support (no tsx needed)
- **Hot Reload**: `bun --watch` (built-in)

All `node`, `npm`, and `npx` commands are aliased to use Bun automatically.

---

## Roadmap

### Completed
- [x] Multiple agent types support (11 agents)
- [x] Memory search across entries
- [x] Memory export/import (JSON)
- [x] Token rotation for security
- [x] Skill scaffold per agent type
- [x] Config command
- [x] JSON output for scripting
- [x] Verbose mode for debugging
- [x] Memory batch operations
- [x] Universal memory system with custom names
- [x] Cross-agent memory sharing
- [x] Complete project documentation

### In Progress
- [ ] Auto-copy MCP JSON config on agent creation
- [ ] Memory encryption at rest (AES-256)
- [ ] Audit logging for memory operations

### Planned
- [ ] Native agent memory integration
- [ ] Web UI dashboard for memory management
- [ ] Multiple memory profiles per agent
- [ ] Memory sync across devices
- [ ] Memory templates for common use cases
- [ ] Memory analytics and insights
- [ ] Memory backup and restore service
- [ ] Memory sharing with permissions
- [ ] Memory versioning and rollback
- [ ] Memory search with advanced filters
- [ ] Memory API for third-party integrations

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

*Memlink = Your agent's memory, your data, your server.*
