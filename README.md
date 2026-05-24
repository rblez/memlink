<p align="center">
  <img src="https://raw.githubusercontent.com/rblez/memlink/main/public/memlink.png" alt="Memlink Logo" width="200" />
</p>

<h1 align="center">Memlink</h1>

<p align="center">
  <strong>Universal Memory for AI Agents</strong><br/>
  Self-hosted · Fast · Organized
</p>

---

Memlink is a self-hosted MCP (Model Context Protocol) server that gives AI agents persistent, organized memory. One memory, one URL, any agent connects.

## Installation

[![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)](#npm)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](#pnpm)
[![yarn](https://img.shields.io/badge/yarn-2C8EBB?style=for-the-badge&logo=yarn&logoColor=white)](#yarn)
[![bun](https://img.shields.io/badge/bun-000000?style=for-the-badge&logo=bun&logoColor=white)](#bun)

### npm

```bash
npm install -g @memlink/cli
```

### pnpm

```bash
pnpm install -g @memlink/cli
```

### Yarn

```bash
yarn global add @memlink/cli
```

### bun

```bash
bun install -g @memlink/cli
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
memlink                              # Show system overview
memlink init my-project              # Create a memory
memlink serve                        # Start MCP server
```

## Commands

| Command | Description |
|---------|-------------|
| `memlink` | System overview: server, memories, entries, size |
| `memlink init <name>` | Create a memory. `--serve` auto-start server |
| `memlink create <name>` | Alias for `init` |
| `memlink delete <id>` | Permanently delete a memory and its data |
| `memlink ls` | List all memories (name, ID, size) |
| `memlink show <id>` | Show full memory as consolidated Markdown |
| `memlink serve` | Start MCP server. `--port`, `--host`, `--cors`, `--read-only`, `--daemon`, `--log-level` |
| `memlink stop` | Stop the daemon server |
| `memlink status` | Check daemon server status |
| `memlink connect <id>` | Get MCP connection details |
| `memlink skill` | Install agent skill. `--global` or `-g` for all projects |
| `memlink bug` | Open GitHub issue with pre-filled template |

## Documentation

Full documentation in [/docs](/docs):

| Document | Description |
|----------|-------------|
| [Installation](/docs/installation.md) | npm, pnpm, yarn, bun, from source |
| [Quick Start](/docs/quickstart.md) | Get running in 2 minutes |
| [CLI Reference](/docs/cli.md) | All commands and flags |
| [MCP Server](/docs/server.md) | Server configuration, auth, transports |
| [MCP Tools](/docs/mcp-tools.md) | All MCP tool details |
| [Agent Setup](/docs/agent-setup.md) | Connect Claude, Cursor, Windsurf, etc. |
| [Skill](/docs/skill.md) | Agent skill installation |
| [Backups](/docs/backups.md) | Backup and restore |
| [Architecture](/docs/architecture.md) | How it works |

### Global flags

| Flag | Description |
|------|-------------|
| `-v, --version` | Show version with runtime info |
| `-h, --help` | Show help with examples and env vars |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMLINK_DIR` | Data directory | `~/.memlink` |
| `MEMLINK_PORT` / `PORT` | Server port | `4444` |
| `MEMLINK_HOST` / `HOST` | Server host | `localhost` |

## Architecture

```
~/.memlink/
├── config.json              # Global config
└── abc123def456.memory.json # Universal memory (JSON)
```

Agents connect via MCP:

```
http://localhost:4444/mcp?id=MEMORY_ID
```

Data flow:

```
User → CLI → Core → Memory Files
Agent → MCP Server → Core → Memory Files
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `memory_read` | Read all entries or by title |
| `memory_edit` | Create or update an entry |
| `memory_delete` | Delete an entry by title |
| `memory_search` | Search by query |
| `memory_sync` | Validate memory integrity |
| `memory_batch` | Bulk create/update |
| `bulk_delete` | Delete by titles/tags/pattern |
| `backup_create` | Create backup |
| `backup_restore` | Restore from backup |
| `backup_list` | List backups |
| `backup_delete` | Delete a backup |
| `backup_cleanup` | Clean old backups |

Full details: [MCP Tools Reference](/docs/mcp-tools.md)

## Robustness

- **Atomic writes**: files written to `.tmp` then renamed — no corruption on crash
- **Auto-backups**: backups created automatically on every mutation, keeping last 3
- **TTY detection**: ASCII art and clipboard disabled in non-TTY (CI, Docker, pipes)
- **Safe clipboard**: clipboard failures handled silently

## Development

```bash
bun install              # Install deps
npm run build            # Build + type check
npm run dev:server       # Server with hot reload
npm run dev:cli          # CLI dev mode
npm run test             # Run tests
npm run lint             # ESLint
npm run format           # Prettier
```

## Project Structure

```
src/
├── cli/index.ts       # CLI entrypoint (commands)
├── cli/output.ts      # Output formatting, colors, branding
├── server/index.ts    # MCP server (Express + @modelcontextprotocol/sdk)
├── core/
│   ├── memory.ts      # File I/O, CRUD, search, backup, bulk ops
│   └── types.ts       # Types, constants
tests/
├── memory.test.ts     # Core memory unit tests
├── server.test.ts     # MCP server integration tests
└── unit.test.ts       # Additional unit tests
```

## CI/CD

```
bun test → bun run build → bun run format:check → bun run lint
```

Releases trigger on `v*` tags via PRs to `main` from `beta`. Publish manually: `npm publish --access public`.

## License

MIT License. See [LICENSE](LICENSE) for details.
