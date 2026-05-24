# Architecture

## Data flow

```
User → CLI → Core → ~/.memlink/*.memory.json
Agent → MCP Server → Core → ~/.memlink/*.memory.json
```

## Directory structure

```
~/.memlink/
├── config.json              # Global config (memories, port, host, exportFormats)
├── formats/                 # Exported formats (md, txt, html, json)
│   └── my-memory.md
├── backups/                 # Auto-backups before every mutation
│   └── abc123_2025-01-01.json
└── abc123def456.memory.json # Memory file (JSON)

~/.agents/
└── skills/memlink/SKILL.md  # Agent skill (when installed globally)
```

## Config file

`~/.memlink/config.json` stores:

```json
{
  "version": "1.0.9",
  "baseDir": "/home/user/.memlink",
  "universalMemories": [
    {
      "memoryId": "abc123def456",
      "memoryName": "my-project",
      "memoryFile": "abc123def456.memory.json",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "serverPort": 4444,
  "serverHost": "localhost",
  "exportFormats": ["md", "txt", "html"]
}
```

The `exportFormats` array controls which formats are written to `~/.memlink/formats/` on every mutation or explicit export. Supported values: `md`, `txt`, `html`, `json`.

## Memory file format

Each memory is a JSON file at `~/.memlink/<id>.memory.json`:

```json
{
  "version": "1.0.9",
  "memoryId": "abc123def456",
  "memoryName": "my-project",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-02T00:00:00.000Z",
  "entries": [
    {
      "title": "ProjectGoals",
      "content": "Build a universal memory layer for AI agents...",
      "startLine": 1,
      "endLine": 5,
      "tags": ["project", "goals"],
      "updatedAt": "2025-01-01T12:00:00.000Z"
    }
  ]
}
```

## MCP transport

Memlink uses **Streamable HTTP** transport from the Model Context Protocol SDK. This is the modern, efficient transport for MCP servers, supporting:

- Long-lived connections for streaming responses
- Standard HTTP methods (POST for tools, GET for health)
- JSON-RPC 2.0 message format

Legacy SSE and Stdio transports are also available for agents that don't support Streamable HTTP.

## Authentication

```
http://localhost:4444/mcp?id=abc123def456
```

## Atomic writes

All file writes follow an atomic pattern to prevent corruption:

1. Write to a temporary file (`<path>.tmp`)
2. Rename temp file to target path (atomic on Linux/macOS)
3. On crash, the temp file is discarded, leaving the original intact

## Auto-backups

Memlink automatically creates a backup before every mutation (create, update, delete). The last 3 backups are retained. Backups are stored in `~/.memlink/backups/`.

## Auto-export

Every mutation (create, update, delete via CLI or MCP) automatically exports the memory to configured formats in `~/.memlink/formats/`. To trigger export manually: `memlink export <name>`.
