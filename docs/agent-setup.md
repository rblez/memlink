# Agent Setup Guide

Memlink works with any MCP-compatible agent. Here's how to configure each one.

## Configuration format

All agents accept an MCP server configuration. Choose the transport matching your agent:

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

**SSE** (legacy — for older agents):
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

Get your memory ID and URL with:

```bash
memlink connect <id>
```

## Claude (Claude Desktop)

1. Open Claude Desktop
2. Go to Settings → Developer → MCP Servers
3. Add a new server with the URL from `memlink connect`

## Cursor

1. Open Cursor Settings → Features → MCP
2. Add a new MCP server:
   - Name: `memlink`
   - URL: `http://localhost:4444/mcp?id=YOUR_MEMORY_ID` (preferred, type: http)
   - Or URL: `http://localhost:4444/sse?id=YOUR_MEMORY_ID` (legacy, type: remote)

## Windsurf

1. Open Windsurf settings
2. Navigate to MCP Server configuration
3. Use Streamable HTTP URL: `http://localhost:4444/mcp?id=YOUR_MEMORY_ID`
4. Or SSE URL for older configs: `http://localhost:4444/sse?id=YOUR_MEMORY_ID`

## Codex

1. Open Codex CLI configuration
2. Add the MCP server entry to your settings

## OpenCode

1. Install the skill:
   ```bash
   memlink skill         # .agents/skills/memlink/ (workspace)
   memlink skill -g      # ~/.agents/skills/memlink/ (global)
   ```
2. The skill tells OpenCode to always read memory at session start and use MCP tools throughout the session
3. Add the MCP server to your `opencode.jsonc` (project root or `~/.config/opencode/opencode.jsonc`):

   **Streamable HTTP** (preferred):
   ```jsonc
   {
     "mcpServers": {
       "memlink": {
         "type": "http",
         "url": "http://localhost:4444/mcp?id=YOUR_MEMORY_ID"
       }
     }
   }
   ```

   **SSE** (legacy):
   ```jsonc
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

## Claude Code

Claude Code supports MCP servers. Add the URL to your Claude Code configuration.

## Cline (VS Code extension)

1. Open VS Code
2. Go to Cline extension settings → MCP Servers
3. Add one of the following:

   **Streamable HTTP** (preferred):
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

   **SSE** (legacy):
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

## LangChain

LangChain supports MCP tool integrations. Use the memlink tools within your LangChain agent setup.

## Running the server

Before connecting any agent, start the Memlink server:

```bash
memlink serve
```

For production use, consider running it as a system service or in Docker.
