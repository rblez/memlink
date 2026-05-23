# Memlink — Universal Memory for AI Agents

Memlink is a self-hosted MCP (Model Context Protocol) server that gives AI agents persistent, organized memory. One memory, one URL, any agent connects.

No tokens. No headers. No OAuth. Just the URL.

## Key Features

- **Universal**: Works with any MCP-compatible agent — Claude, Cursor, Windsurf, Codex, OpenCode, Claude Code, Cline, LangChain
- **Self-hosted**: Runs locally, no cloud dependency, no data leaving your machine
- **Persistent**: Memory survives across sessions — agents pick up where they left off
- **Atomic writes**: Files written to `.tmp` then renamed — no corruption on crash
- **Auto-backups**: Backups created automatically on every mutation, keeping last 3
- **Searchable**: Full-text search across titles, content, and tags
- **Batch operations**: Create, update, or delete multiple entries at once
- **CLI + MCP**: Work via terminal or connect any MCP agent

## How it works

```
User → CLI → Core → ~/.memlink/*.memory.json
Agent → MCP Server → Core → ~/.memlink/*.memory.json
```

Memlink stores memories as structured JSON files in `~/.memlink/`. Each memory gets a unique 12-character ID. Agents connect via the MCP protocol over HTTP.
