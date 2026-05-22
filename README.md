<p align="center">
  <img src="assets/memlink.png" alt="Memlink Logo" width="400" />
</p>

<h1 align="center">Memlink</h1>

<p align="center">
  <strong>Universal Memory for AI Agents</strong><br/>
  Self-hosted · Fast · Organized
</p>

---

Memlink is a self-hosted MCP (Model Context Protocol) server that gives AI agents persistent, organized memory. One memory, one URL, any agent connects.

No tokens. No headers. No OAuth. Just the URL.

## Installation

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#windows)
[![macOS/Linux](https://img.shields.io/badge/macOS%2FLinux-000000?style=for-the-badge&logo=apple&logoColor=white)](#macoslinux)
[![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)](#npm)
[![bun](https://img.shields.io/badge/bun-000000?style=for-the-badge&logo=bun&logoColor=white)](#bun)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](#pnpm)
[![yarn](https://img.shields.io/badge/yarn-2C8EBB?style=for-the-badge&logo=yarn&logoColor=white)](#yarn)

### Windows

**PowerShell:**
```powershell
iex (iwr memlink.rblez.com/install.sh).Content
```

**CMD:**
```cmd
powershell -c "iex (iwr memlink.rblez.com/install.sh).Content"
```

### macOS/Linux

**sh:**
```bash
curl -sL memlink.rblez.com/install.sh | sh
```

**bash:**
```bash
curl -sL memlink.rblez.com/install.sh | bash
```

### npm
```bash
npm install -g memlink
```

### bun
```bash
bun install -g memlink
```

### pnpm
```bash
pnpm add -g memlink
```

### yarn
```bash
yarn global add memlink
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
memlink init my-project    # Create memory + install skill
memlink serve              # Start MCP server
memlink connect <id>       # Get connection details
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `memlink` | Show banner + help |
| `memlink init [name]` | Create memory, auto-install skill, copy URL |
| `memlink create [name]` | Alias for `init` |
| `memlink serve [-p port] [-H host]` | Start MCP server |
| `memlink status` | System status: server, memories, size |
| `memlink bug` | Open GitHub to report bug or feedback |

### Memory

| Command | Description |
|---------|-------------|
| `memlink memory list` | List all memories |
| `memlink memory show <id>` | Show full memory content |
| `memlink memory show <id> --entries` | List all entries |
| `memlink memory show <id> --title <t>` | Show specific entry |

### Flags

| Flag | Description |
|------|-------------|
| `-v, --version` | Show version |
| `-h, --help` | Show help |

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

Agents have access to these tools:

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

## Skill Installation

Memlink auto-installs a skill file for agents at `~/.agents/skills/memlink/` (global, all OS).

The skill teaches agents how to use memlink MCP tools:

- `memory_read` — retrieve stored context
- `memory_edit` — store new context
- `memory_search` — find relevant entries
- `memory_delete` — forget something
- `memory_sync` — verify memory state

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
├── server/index.ts    # MCP server (Express + @modelcontextprotocol/sdk)
├── core/
│   ├── memory.ts      # File I/O, CRUD, search, backup, bulk ops
│   ├── types.ts       # Types, constants
│   ── scaffold.ts    # Agent configs, MCP config/skill scaffolding
└── update/            # Self-update (check latest release)
tests/
├── memory.test.ts     # Core memory unit tests
├── server.test.ts     # MCP server integration tests
└── unit.test.ts       # Additional unit tests
```

## CI/CD

```
bun test → bun run build → bun run format:check → bun run lint
```

Releases trigger on `v*` tags → builds 5 platform binaries + npm publish.

## License

BUSL 1.1 — Personal use and self-hosting allowed.
Changes to MIT on 2030-01-01.
See [LICENSE](LICENSE) for details.
