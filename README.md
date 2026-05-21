# Memlink

> **Universal Memory for AI Agents. Self-hosted, Fast, Organized.**

![Memlink](assets/memlink.png)

Memlink is a self-hosted MCP (Model Context Protocol) server that gives AI agents persistent, organized memory. One memory, one URL, any agent connects.

## Installation

```bash
curl -sL rblez.com/memlink/install.sh | bash
```

Or via npm:

```bash
npm install -g memlink
```

## Quick Start

```bash
memlink init       # Create your first memory
memlink serve      # Start the MCP server
memlink connect    # Get connection details + install skill
```

## Commands

| Command | Description |
|---------|-------------|
| `memlink` | Show banner + main commands |
| `memlink init` | Create a memory, install skill, copy URL |
| `memlink serve [-l]` | Start MCP server (optional: live logs) |
| `memlink connect` | Select memory, get MCP config, install skill |
| `memlink status` | System status: URL, memories, size |
| `memlink memory list` | List all memories |
| `memlink memory show [id]` | Show memory contents |
| `memlink --help` | All commands and flags |

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

No tokens. No headers. No OAuth. Just the URL.

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

Memlink can install a skill file for agents:

- **Workspace**: `./AGENTS.md` + `./.agents/skills/memlink/`
- **Global**: `~/.agents/skills/memlink/`

The skill teaches agents how to use memlink MCP tools.

## License

BUSL 1.1 — Personal use and self-hosting allowed.
Changes to MIT on 2030-01-01.
See [LICENSE](LICENSE) for details.
