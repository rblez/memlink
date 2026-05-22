# Server

MCP (Model Context Protocol) server that exposes memory tools to AI agents.

## Entry Point

`index.ts` — Express server + `@modelcontextprotocol/sdk` with streamable HTTP transport.

## Auth

No tokens. No headers. No OAuth. Auth via query param:

```
http://localhost:4444/mcp?id=MEMORY_ID
```

Legacy `Authorization: Bearer <token>` still supported as fallback.

## MCP Tools

| Tool | Description | Params |
|------|-------------|--------|
| `memory_read` | Read all entries or by title | `title?` |
| `memory_edit` | Create or update entry | `title`, `content`, `tags?` |
| `memory_delete` | Delete entry by title | `title` |
| `memory_search` | Search by query | `query` |
| `memory_sync` | Validate memory integrity | — |
| `memory_batch` | Bulk create/update | `entries[]` |
| `bulk_delete` | Delete by titles/tags/pattern | `titles?`, `tags?`, `pattern?` |
| `backup_create` | Create backup | — |
| `backup_restore` | Restore from backup | `backupFile` |
| `backup_list` | List backups | — |
| `backup_delete` | Delete a backup | `backupFile` |
| `backup_cleanup` | Clean old backups | `keep?` |

## MCP Resources

| Resource | Description |
|----------|-------------|
| `memlink://instructions` | Agent rules: read memory at start, save important info, detect memory commands |
| `memlink://agents` | List all registered memories |

## Server Setup

```typescript
import { startServer } from './server/index.ts';

await startServer(port, host);
```

Default: `http://localhost:4444/mcp`

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint |
| `/health` | GET | Health check |

## Agent Connection

```json
{
  "mcpServers": {
    "memlink": {
      "url": "http://localhost:4444/mcp?id=MEMORY_ID"
    }
  }
}
```

## Protocol Flow

1. Agent sends request → `POST /mcp?id=MEMORY_ID`
2. Server extracts memory ID from query param
3. MCP transport routes to appropriate tool
4. Tool executes memory operation via `core/memory.ts`
5. Response returned to agent

## Error Handling

| Error | Response |
|-------|----------|
| Missing memory ID | 401 |
| Memory not found | 404 |
| Invalid params | Tool error |
| Server error | Logged to console |

## Logging

Logs always on (no toggle):

- Startup message with URLs
- Memory connections
- Tool invocations
- Errors and warnings

## Dependencies

- `express` — HTTP server
- `@modelcontextprotocol/sdk` — MCP SDK
- `zod` — schema validation

## Usage

```bash
# Start server
memlink serve

# Custom port/host
memlink serve -p 4445 -H 0.0.0.0
```

## Dev

```bash
npm run dev:server    # bun --watch src/server/index.ts
```

## Test

```bash
curl http://localhost:4444/health
```

## Performance

- Stateless design (no server-side sessions)
- Memory files loaded on-demand
- Efficient JSON parsing
- Minimal memory footprint
