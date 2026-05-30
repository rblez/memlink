# Server

MCP (Model Context Protocol) server that exposes memory tools to AI agents.

## Entry Point

`index.ts` — Express server + `@modelcontextprotocol/sdk` with streamable HTTP transport.

## Auth

No tokens. No headers. No OAuth. Auth via query param:

```
http://localhost:4444/mcp?id=MEMORY_ID
```

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

## Server Setup

```typescript
import { startServer } from './server/index.ts';

await startServer(port, host);
```

Default: `http://localhost:4444/mcp`

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint (streamable HTTP) |
| `/health` | GET | Health check |
| `/instructions` | GET | Agent system prompt for a memory |
| `/changelogs` | GET | Release changelog (dark theme, Geist Pixel font) |
| `/public/*` | GET | Static assets (fonts, images) |

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
5. Response returned to agent (streamable HTTP — JSON or SSE)

## Environment Variables

| Variable | Description | Priority |
|----------|-------------|----------|
| `MEMLINK_PORT` / `PORT` | Server port | CLI arg > env var > config > default |
| `MEMLINK_HOST` / `HOST` | Server host | CLI arg > env var > config > default |

## Error Handling

| Error | Response |
|-------|----------|
| Missing memory ID | 401 |
| Memory not found | 403 |
| Invalid params | Tool error |
| Server error | Logged to console |

## Logging

Logs always on (no toggle):

- Startup message with URLs
- Memory connections
- Tool invocations with method name and latency
- Response preview (first 80 chars)

## Dependencies

- `express` — HTTP server
- `express-rate-limit` — rate limiting (1000 req/min)
- `@modelcontextprotocol/sdk` — MCP SDK
- `zod` — schema validation

## Usage

```bash
# Start server
memlink serve

# Custom port/host
memlink serve -p 4445 -H 0.0.0.0

# With env vars
MEMLINK_PORT=8080 MEMLINK_HOST=0.0.0.0 memlink serve
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
