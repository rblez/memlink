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

Memlink is a self-hosted [MCP](https://modelcontextprotocol.io) server that gives AI agents persistent, organized memory. One install, one URL, any agent connects — Claude, Cursor, Windsurf, or any MCP-compatible client.

## Installation

```bash
npm install -g @memlink/cli
```

Requires Node.js 18+ or Bun 1.0+. Also works with `pnpm`, `yarn`, and `bun`.

**From source:**

```bash
git clone https://github.com/rblez/memlink.git
cd memlink && bun install && npm run build
```

## Quick Start

```bash
memlink serve --daemon                  # Start MCP server in background
memlink url                             # Copy MCP config JSON for your agent
memlink add "My note" "Hello world"     # Write an entry
memlink entries                         # List entries
memlink search "hello"                  # Search entries
memlink edit 1 --content "Updated"      # Edit an entry by ID
```

## Connecting an Agent

Run `memlink url` after starting the server — it prints the exact JSON block to paste into your agent's MCP config:

**Claude Desktop** → `~/Library/Application Support/Claude/claude_desktop_config.json`
**Cursor** → Settings → MCP
**Windsurf** → `~/.codeium/windsurf/mcp_config.json`

Restart the agent after adding the config. On the next session it will call `memory_read` automatically and load your entries.

## Commands

### Memory

| Command | Description |
|---------|-------------|
| `memlink add "<title>" "<content>"` | Write an entry (`--tags`, `--memory`) |
| `memlink edit <id>` | Edit an entry by ID (`--title`, `--content`, `--tags`, `--memory`) |
| `memlink entries` | List entries (`--memory`) |
| `memlink search <query>` | Search by title, content, or tags (`--memory`) |

### Server

| Command | Description |
|---------|-------------|
| `memlink serve` | Start MCP server (`--port`, `--host`, `--daemon`, `--transport`, `--memory`) |
| `memlink serve --daemon` | Run server in background |
| `memlink status` | Check if daemon is running |
| `memlink stop` | Stop the daemon |
| `memlink url` | Show MCP URL and config JSON |

### Memories

| Command | Description |
|---------|-------------|
| `memlink info <name>` | Stats and metadata for a memory |
| `memlink pause --memory <name>` | Suspend a memory (data intact) |
| `memlink resume --memory <name>` | Resume a paused memory |
| `memlink stop --memory <name>` | Remove a memory from active routing |
| `memlink delete <name>` | Permanently delete a memory |
| `memlink export <name>` | Export memory to JSON |
| `memlink import <name> <file>` | Import entries from JSON |

### Tokens & Config

| Command | Description |
|---------|-------------|
| `memlink token` | Generate a new token |
| `memlink token list` | List active tokens |
| `memlink token revoke <label>` | Revoke a token |
| `memlink config` | View configuration |
| `memlink config get <key>` | Get a config value |
| `memlink config set <key> <val>` | Set a config value |
| `memlink skill` | Install agent skill (`SKILL.md`) |
| `memlink connect` | Link CLI with [memlink.cloud](https://memlink.cloud) via device flow |
| `memlink disconnect` | Unlink from memlink.cloud |
| `memlink sync` | Sync memory with memlink.cloud (`--push`, `--pull`, `--memory`) |

## MCP Tools

Agents interact via these MCP tools:

| Tool | Description |
|------|-------------|
| `memory_read` | Read index or a specific entry (`id?`, `title?`, `full?`) |
| `memory_edit` | Create or update an entry (`title`, `content`, `tags?`) |
| `memory_search` | Search entries by query |
| `memory_sync` | Memory stats (count, size, last updated) |

Connection URLs:

```
http://localhost:4444/mcp                # default memory
http://localhost:4444/mcp?t=<TOKEN>      # named memory
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMLINK_DIR` | `~/.memlink` | Data directory |
| `MEMLINK_PORT` / `PORT` | `4444` | Server port |
| `MEMLINK_HOST` / `HOST` | `localhost` | Server host |
| `MEMLINK_CLOUD_URL` | `https://memlink.cloud` | Cloud endpoint |
| `MEMLINK_DEBUG` | — | Enable VBScript debug logging (Windows) |

## Data Layout

```
~/.memlink/
├── settings.json          # Global config + admin token
├── .serve.pid             # Daemon PID
├── default/               # Default memory (auto-created)
│   ├── meta.json          # Memory metadata + status
│   ├── index.json         # Entry index (titles, tags, timestamps)
│   ├── 1.md, 2.md, ...    # Entries with YAML frontmatter
│   └── .backups/          # Timestamped backups on every write
└── my-project/            # Named memory
    └── ...
```

## Robustness

- **Atomic writes** — `.tmp` + `renameSync()`, no partial writes
- **Auto-backups** — every mutation backed up to `.backups/`
- **File lock** — concurrent writes serialized via `.lock` with TTL + retry
- **Token routing** — in-memory `Map<token, MemoryRoute>`, no IPC overhead
- **Health ticker** — 30s heartbeat written to `.health`
- **Rate limiting** — 1000 req/min per IP
- **TTY detection** — banners and clipboard ops disabled in CI/Docker

## Development

```bash
bun install          # Install dependencies
npm run build        # Build CLI + server
npm run dev:server   # Server with hot reload
npm run dev:cli      # CLI dev mode
npm run test         # Run tests
npm run lint         # ESLint
npm run format       # Prettier
```

## Project Structure

```
src/
├── cli/
│   ├── index.ts          # CLI entrypoint (commander)
│   ├── output.ts         # Colors, badges, branding
│   ├── admin.ts          # Daemon admin API client
│   └── commands/         # One file per command
├── server/index.ts       # MCP server (Express + MCP SDK)
└── core/
    ├── storage.ts        # Entry CRUD, atomic writes, backups
    ├── meta.ts           # Per-memory meta.json
    ├── routing.ts        # Token → MemoryRoute map
    ├── health.ts         # Daemon heartbeat
    ├── auth.ts           # Admin token
    ├── lock.ts           # File lock with TTL
    ├── memory.ts         # Config + CLI helpers
    └── types.ts          # Shared types and constants
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
