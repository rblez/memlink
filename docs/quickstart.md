# Quick Start

## 1. Start the server

```bash
memlink serve --daemon
```

Server runs at `http://localhost:4444/mcp` and serves the **default** memory (auto-created at `~/.memlink/default/`).

## 2. Connect an agent

Get the MCP config for your agent:

```bash
memlink url
```

Paste the JSON into your agent's MCP settings.

**Streamable HTTP** (modern — preferred):
```json
{
  "mcpServers": {
    "memlink": {
      "type": "http",
      "url": "http://localhost:4444/mcp"
    }
  }
}
```

**SSE** (legacy — for older agents):
```json
{
  "mcpServers": {
    "memlink": {
      "type": "remote",
      "url": "http://localhost:4444/sse",
      "enabled": true
    }
  }
}
```

## 3. Write and read

Via CLI:
```bash
memlink add "First note" "Hello world"
memlink entries
memlink search "hello"
```

Via MCP (from the agent):
```json
{ "tool": "memory_edit", "args": { "title": "First note", "content": "Hello world" } }
{ "tool": "memory_read", "args": {} }
```

## 4. Create more memories

Memories are created implicitly on first use:

```bash
memlink add "Project goals" "..." --memory my-project
memlink entries --memory my-project
```

Each memory gets a unique token. Connect to it with:
```
http://localhost:4444/mcp?t=<token>
```

## 5. Manage

```bash
memlink status      # Is the daemon running?
memlink token list  # Show all memory tokens
memlink stop        # Stop the daemon
```

## What's next?

- Learn all [CLI commands](cli.md)
- Configure the [MCP server](server.md) (port, host, CORS, read-only)
- Explore all [MCP tools](mcp-tools.md)
- Configure [specific agents](agent-setup.md)
