# Quick Start

## 1. Create a memory

```bash
memlink init my-project
```

This creates a memory called "my-project" and prints its unique 12-character ID and connection URL.

## 2. Start the MCP server

```bash
memlink serve
```

The server serves two MCP transport endpoints:
- **Streamable HTTP** (modern): `http://localhost:4444/mcp?id=YOUR_MEMORY_ID`
- **SSE** (legacy): `http://localhost:4444/sse?id=YOUR_MEMORY_ID`

Each memory you created gets its own URL with the memory ID.

## 3. Connect an agent

Add the MCP URL to your agent's configuration. Choose the transport that matches your agent:

**Streamable HTTP** (modern — preferred):
```json
{
  "mcpServers": {
    "memlink": {
      "type": "http",
      "url": "http://localhost:4444/mcp?id=YOUR_MEMORY_ID"
    }
  }
}
```

**SSE** (legacy — for older agents that don't support Streamable HTTP):
```json
{
  "mcpServers": {
    "memlink": {
      "type": "remote",
      "url": "http://localhost:4444/sse?id=YOUR_MEMORY_ID",
      "enabled": true
    }
  }
}
```

The agent can now read, write, search, and delete memory entries using MCP tools.

## 4. View memories

```bash
memlink ls               # List all memories
memlink show <id>        # View memory contents as Markdown
```

## 5. Delete a memory

```bash
memlink delete <id>      # Permanently delete a memory and its data
```

## What's next?

- Learn all [CLI commands](cli.md)
- Set up the [MCP server](server.md) with custom port/host
- Explore all [MCP tools](mcp-tools.md)
- Configure [specific agents](agent-setup.md)
