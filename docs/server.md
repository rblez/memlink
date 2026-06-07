# MCP Server

## Starting the server

```bash
memlink serve --daemon
```

This starts an Express-based MCP server at `http://localhost:4444`. On startup it auto-creates the default memory (`~/.memlink/default/`) and registers it with the in-memory token router.

The server exposes:
- `GET /health` — health check
- `POST /mcp?t=<token>` — Streamable HTTP transport
- `GET /sse?t=<token>` — SSE transport (legacy)
- `POST /admin/{register,pause,resume,stop}` — admin API (local token required)

## MCP request flow

```mermaid
flowchart TD
    A[Agent sends<br/>JSON-RPC 2.0] --> B{Transport?}
    B -->|Streamable HTTP| C[POST /mcp?t=... or /mcp]
    B -->|SSE| D[GET /sse?t=... or /sse]
    B -->|Stdio| E[stdin/stdout]
    C --> F[Parse JSON-RPC]
    D --> F
    E --> F
    F --> G{Method?}
    G -->|initialize| H[Send capabilities<br/>server name: memlink]
    G -->|tools/list| I[Return 4-tool list]
    G -->|tools/call| J[Extract params:<br/>name, arguments]
    H --> K[JSON-RPC response]
    I --> K
    J --> L[Token lookup]
    L --> M{Route found?}
    M -->|No + no token| N[Route to default memory]
    M -->|No + token| O[401 Unauthorized]
    M -->|Yes + paused| P[503 Service Unavailable]
    M -->|Yes + active| Q[Memory locked<br/>TTL 10s]
    N --> Q
    Q --> R[Execute tool handler<br/>memory_read / edit / search / sync]
    R --> S[Atomic write → index.json + N.md]
    S --> T[Auto-backup → .backups/]
    T --> U[Unlock]
    U --> K
    O --> K
    P --> K
```

## Token routing

```mermaid
flowchart TD
    A[Request: /mcp?t=abc123] --> B[Parse query string]
    A2[Request: /mcp<br/>no token] --> B2[Token = null]
    B --> C[Look up in Map<token, MemoryRoute>]
    C --> D{Match?}
    D -->|Yes + active| E[route.token = abc123]
    D -->|Yes + paused| F[503]
    D -->|No| G[401 Unauthorized]
    B2 --> H[Token = null → default memory]
    E --> I[Use route's memory<br/>name, dir, lock, status]
    H --> I
    I --> J[Continue to tool handler]
    F --> K[Error response]
    G --> K
```

Token registration happens via:
- Daemon startup — auto-registers the default memory with token from `meta.json`
- `POST /admin/register` (admin API) — registers a memory with the running daemon
- `memlink pause --memory <name>` / `memlink resume` — toggles status without daemon restart

## Transports

Memlink supports three MCP transport protocols:

| Transport | URL / Config | Type |
|-----------|-------------|------|
| **Streamable HTTP** (modern) | `http://localhost:4444/mcp?t=TOKEN` | `"type": "http"` |
| **SSE** (legacy) | `http://localhost:4444/sse?t=TOKEN` | `"type": "remote"` |
| **Stdio** (subprocess) | `memlink serve --transport stdio --memory MEMORY` | `"type": "stdio"` |

Select transport with `--transport`:

```bash
memlink serve                           # Default: both HTTP transports
memlink serve --transport http          # Streamable HTTP only
memlink serve --transport sse           # SSE only
memlink serve --transport http,sse      # Both HTTP transports
memlink serve --transport stdio --memory my-memory   # Stdio (subprocess)
```

Stdio is for CLI agents that prefer launching the server as a subprocess. Requires `--memory` to specify which memory to serve (stdin/stdout only, cannot serve multiple memories).

## Custom port and host

```bash
memlink serve --port 8080 --host 0.0.0.0
```

Or via environment variables:

```bash
export MEMLINK_PORT=8080
export MEMLINK_HOST=0.0.0.0
memlink serve
```

## CORS and read-only mode

```bash
memlink serve --cors "*"              # Allow all origins
memlink serve --cors "http://app.local,https://app.com"
memlink serve --read-only             # Disable all write operations
```

## Authentication

Authentication uses the memory token in the query string:

```
http://localhost:4444/mcp?t=<token>
```

When no token is provided, requests are routed to the default memory (auto-created on first run). For optional Bearer auth, use `--bearer-token`:

```bash
memlink serve --bearer-token <secret>
# Client sends: Authorization: Bearer <secret>
```

## Health check

```
GET http://localhost:4444/health
```

Returns `200 OK` if the server is running. The daemon also writes `~/.memlink/.health` every 30 seconds; the existence and freshness of this file indicates the daemon is alive.

## Admin API

Localhost-only endpoints for runtime control (token in `~/.memlink/settings.json` → `auth.localToken`):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/admin/register` | Register a new memory route (body: `{name, token, status?}`) |
| `POST` | `/admin/pause` | Pause a memory (body: `{name}`) |
| `POST` | `/admin/resume` | Resume a paused memory (body: `{name}`) |
| `POST` | `/admin/stop` | Remove a memory from routing (body: `{name}`) |

The CLI wraps these:

```bash
memlink token list
memlink token revoke <token>
memlink pause --memory <name>
memlink resume --memory <name>
memlink stop --memory <name>   # remove from routing, not kill daemon
```

## Programmatic usage

```typescript
import { startServer } from '@memlink/cli/server';

await startServer(4444, 'localhost', {
  cors: '*',
  readOnly: false,
  logLevel: 'verbose',
  bearerToken: undefined,
});
```
