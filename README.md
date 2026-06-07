<p align="center">
  <img src="https://raw.githubusercontent.com/rblez/memlink/main/public/memlink.png" alt="Memlink Logo" width="200" />
</p>

<h1 align="center">Memlink</h1>

<p align="center">
  <strong>Universal Memory for AI Agents</strong><br/>
  Self-hosted · Fast · Organized
</p>

<p align="center">
  <a href="https://github.com/rblez/memlink/releases/latest"><img src="https://img.shields.io/github/v/release/rblez/memlink?style=flat-square" alt="Release"/></a>
  <a href="https://github.com/rblez/memlink/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-blue?style=flat-square" alt="License"/></a>
  <a href="https://www.npmjs.com/package/@memlink/cli"><img src="https://img.shields.io/npm/v/@memlink/cli?style=flat-square" alt="npm"/></a>
</p>

---

Memlink is a self-hosted MCP (Model Context Protocol) server that gives AI agents persistent, organized memory. One memory, one URL, any agent connects.

## Installation

### npm (requires Node 18+ or Bun)

```bash
npm install -g @memlink/cli   # or pnpm / yarn / bun
```

### From source

```bash
git clone https://github.com/rblez/memlink.git
cd memlink
bun install
npm run build
```

## Quick Start

```bash
memlink                                # System overview
memlink add "First note" "Hello world"  # Write to default memory
memlink entries                        # List entries
memlink search "hello"                 # Search entries
memlink serve --daemon                 # Start MCP server in background
memlink url                            # Show MCP config for your agent
```

## Connect an AI agent

```mermaid
flowchart LR
    A[memlink serve --daemon] --> B[memlink url]
    B --> C[Copy MCP config JSON]
    C --> D{Which agent?}
    D -->|Claude Desktop| E[claude_desktop_config.json]
    D -->|Cursor| F[Cursor MCP settings]
    D -->|Windsurf| G[~/.codeium/windsurf/mcp_config.json]
    D -->|Other| H[Custom MCP client]
    E --> I[Restart agent]
    F --> I
    G --> I
    H --> I
    I --> J[Agent calls memory_read<br/>on session start]
    J --> K[Memlink serves entries<br/>from default memory]
```

## Run the server

```bash
memlink serve --daemon
```

Same on Linux, macOS, and Windows. Runs as long as your session is active (or until `memlink stop`).

## Commands

| Command | Description |
|---------|-------------|
| `memlink add "<title>" "<content>"` | Write entry to default memory (`--tags`, `--memory`) |
| `memlink entries` | List entries in default memory (`--memory`, `--limit`) |
| `memlink search <query>` | Search entries by title/tags (`--memory`, `--limit`) |
| `memlink url` | Show MCP config JSON for the agent |
| `memlink token [list\|revoke]` | Manage memory tokens |
| `memlink pause --memory <name>` | Suspend a memory in the daemon |
| `memlink resume --memory <name>` | Resume a paused memory |
| `memlink stop [--memory <name>]` | Stop daemon (or remove a memory) |
| `memlink serve` | Start MCP server (`--port`, `--host`, `--daemon`, `--memory`) |
| `memlink status` | Daemon + memory stats |
| `memlink info <name\|id>` | Memory details |
| `memlink delete <name\|id>` | Permanently delete a memory |
| `memlink export [name\|id]` | Export to `.md` / `.json` / `.txt` |
| `memlink import <name\|id> <file>` | Import entries from JSON |
| `memlink config` | View or modify config (`get`, `set`) |
| `memlink skill` | Install agent skill (use `--global` for all projects) |

## Documentation

| Document | Description |
|----------|-------------|
| [Installation](/docs/installation.md) | All install methods + daemon setup |
| [Quick Start](/docs/quickstart.md) | Get running in 2 minutes |
| [CLI Reference](/docs/cli.md) | All commands and flags |
| [MCP Server](/docs/server.md) | Server config, auth, transports |
| [MCP Tools](/docs/mcp-tools.md) | All MCP tool details |
| [Agent Setup](/docs/agent-setup.md) | Connect Claude, Cursor, Windsurf, etc. |
| [Skill](/docs/skill.md) | Agent skill installation |
| [Backups](/docs/backups.md) | Backup and restore |
| [Architecture](/docs/architecture.md) | How it works |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMLINK_DIR` | Data directory | `~/.memlink` |
| `MEMLINK_PORT` / `PORT` | Server port | `4444` |
| `MEMLINK_HOST` / `HOST` | Server host | `localhost` |
| `MEMLINK_DEBUG` | Log VBScript path for debugging on Windows | unset |

## MCP Tools

| Tool | Description | Params |
|------|-------------|--------|
| `memory_read` | Read index or specific entry | `id?`, `title?`, `full?` |
| `memory_edit` | Create or update an entry | `title`, `content`, `tags?` |
| `memory_search` | Search by query | `query` |
| `memory_sync` | Memory stats (count, size, last updated) | — |

Agents connect via:
```
http://localhost:4444/mcp?t=<TOKEN>      # named memory
http://localhost:4444/mcp                 # default memory
```

## Architecture

```
~/.memlink/
├── settings.json              # Global config
├── default/                   # Default memory (auto-created)
│   ├── meta.json
│   ├── index.json
│   ├── 1.md, 2.md, ...        # Entries with YAML frontmatter
│   └── .backups/
├── my-project/                # Named memory
│   └── ...
```

## Robustness

- **Atomic writes**: files written to `.tmp` then renamed
- **Auto-backups**: every edit creates a backup in `.backups/`
- **File lock**: concurrent writes serialized via `.lock` with TTL + retry
- **Token routing**: in-memory `Map<token, MemoryRoute>` (no IPC)
- **Health ticker**: 30s heartbeat in `.health`
- **TTY detection**: ASCII art disabled in non-TTY (CI, Docker)

## Development

```bash
bun install              # Install deps
npm run build            # Build + typecheck
npm run dev:server       # Server with hot reload
npm run dev:cli          # CLI dev mode
npm run test             # Run tests
npm run lint             # ESLint
npm run format           # Prettier
```

## Project Structure

```
src/
├── cli/index.ts        # CLI entrypoint (commander)
├── cli/output.ts       # Output formatting, colors, branding, skill template
├── cli/admin.ts        # CLI client for daemon admin API
├── server/index.ts     # MCP server (Express + @modelcontextprotocol/sdk)
├── core/
│   ├── storage.ts      # .md entries with YAML frontmatter, atomic writes
│   ├── meta.ts         # Per-memory meta.json CRUD, status tracking
│   ├── routing.ts      # Token → MemoryRoute map
│   ├── health.ts       # .health heartbeat
│   ├── auth.ts         # Local token (admin API)
│   ├── lock.ts         # .lock with TTL + withLock helper
│   ├── memory.ts       # Legacy CRUD, CLI helpers, config
│   └── types.ts        # Types, constants, getMemlinkDir
tests/
├── memory.test.ts      # Core memory unit tests
├── server.test.ts      # MCP server integration tests
└── unit.test.ts        # Edge cases
```

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
