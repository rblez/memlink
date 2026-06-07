# MCP Server

## Starting the server

```bash
memlink serve
```

This starts an Express-based MCP server at `http://localhost:4444/mcp`.

## MCP request flow

```mermaid
flowchart TD
    A[Agent sends<br/>JSON-RPC 2.0] --> B{Transport?}
    B -->|Streamable HTTP| C[POST /mcp]
    B -->|SSE| D[GET /sse]
    B -->|Stdio| E[stdin/stdout]
    C --> F[Parse JSON-RPC]
    D --> F
    E --> F
    F --> G{Method?}
    G -->|initialize| H[Send capabilities]
    G -->|tools/list| I[Return tool list]
    G -->|tools/call| J[Extract params:<br/>name, arguments]
    H --> K[JSON-RPC response]
    I --> K
    J --> L[Token lookup]
    L --> M{Route found?}
    M -->|No + no token| N[Route to default memory]
    M -->|No + token| O[401 Unauthorized]
    M -->|Yes| P[Memory locked<br/>TTL 10s]
    N --> P
    P --> Q[Execute tool handler<br/>memory_read / edit / search / etc]
    Q --> R[Atomic write → index.json + N.md]
    R --> S[Auto-backup → .backups/]
    S --> T[Unlock]
    T --> K
    O --> K
```

## Token routing

```mermaid
flowchart TD
    A[Request: /mcp?t=abc123] --> B[Parse query string]
    A2[Request: /mcp] --> B2[No token]
    B --> C[Look up in Map<token, MemoryRoute>]
    C --> D{Match?}
    D -->|Yes| E[route.token = abc123]
    D -->|No| F[401 Unauthorized]
    B2 --> G[route.token = null]
    E --> H[Use route's memory<br/>name, dir, lock, status]
    G --> I[Use 'default' memory<br/>auto-created at ~/.memlink/default/]
    H --> J[Continue to tool handler]
    I --> J
    F --> K[Error response]
```

Token registration happens via:
- `memlink token create <name>` — generates token, stores in `meta.json`
- `memlink serve --memory <name>` — registers `Map<token, route>` at startup
- `POST /admin/register` (admin API) — registers a memory with the running daemon

## Transports

Memlink supports three MCP transport protocols:

| Transport | URL / Config | Type |
|-----------|-------------|------|
| **Streamable HTTP** (modern) | `http://localhost:4444/mcp?id=MEMORY_ID` | `"type": "http"` |
| **SSE** (legacy) | `http://localhost:4444/sse?id=MEMORY_ID` | `"type": "remote"` |
| **Stdio** (subprocess) | `memlink serve --transport stdio --memory MEMORY` | `"type": "stdio"` |

Select transport with `--transport`:

```bash
memlink serve                           # Default: all HTTP transports
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

Authentication uses the memory ID in the query string:

```
http://localhost:4444/mcp?id=abc123def456
```

Both `?id=` (preferred) and `?mem_id=` (legacy) are accepted.

## Health check

```
GET http://localhost:4444/health
```

Returns `200 OK` if the server is running.

## MCP transport

Memlink supports two MCP transport protocols:

1. **Streamable HTTP** (modern — preferred): Uses the [Streamable HTTP](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/) transport from the Model Context Protocol SDK. Efficient, supports long-lived connections for streaming responses.
2. **SSE** (legacy): Uses standard Server-Sent Events for agents that don't yet support Streamable HTTP. Configured with `"type": "remote"` and `"enabled": true`.

Both transports serve the same MCP tools.

## Programmatic usage

```typescript
import { startServer } from '@memlink/cli/server';

await startServer(4444, 'localhost', { cors: '*', readOnly: false });
```
