# Agent Setup Guide

Memlink works with any MCP-compatible agent. Here's how to configure each one.

## Configuration format

The default memory is always served at `http://localhost:4444/mcp` (no token). For named memories, use the token in the query string.

Get the right URL for any memory with:

```bash
memlink url                 # default memory
memlink url --memory my-project   # named memory
```

**Streamable HTTP** (modern — preferred):
```json
{
  "mcpServers": {
    "memlink": {
      "type": "http",
      "url": "http://localhost:4444/mcp?t=YOUR_TOKEN"
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
      "url": "http://localhost:4444/sse?t=YOUR_TOKEN",
      "enabled": true
    }
  }
}
```

## Claude (Claude Desktop)

1. Open Claude Desktop
2. Go to Settings → Developer → MCP Servers
3. Add a new server with the URL from `memlink url`

## Cursor

1. Open Cursor Settings → Features → MCP
2. Add a new MCP server:
   - Name: `memlink`
   - URL: `http://localhost:4444/mcp?t=YOUR_TOKEN` (preferred, type: http)
   - Or URL: `http://localhost:4444/sse?t=YOUR_TOKEN` (legacy, type: remote)

## Windsurf

1. Open Windsurf settings
2. Navigate to MCP Server configuration
3. Use Streamable HTTP URL: `http://localhost:4444/mcp?t=YOUR_TOKEN`
4. Or SSE URL for older configs: `http://localhost:4444/sse?t=YOUR_TOKEN`

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
         "url": "http://localhost:4444/mcp?t=YOUR_TOKEN"
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
         "url": "http://localhost:4444/sse?t=YOUR_TOKEN",
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
         "url": "http://localhost:4444/mcp?t=YOUR_TOKEN"
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
         "url": "http://localhost:4444/sse?t=YOUR_TOKEN",
         "enabled": true
       }
     }
   }
   ```

## LangChain

LangChain supports MCP tool integrations. Use the memlink tools within your LangChain agent setup.

## Running the server

Before connecting any agent, start the Memlink daemon:

```bash
memlink serve --daemon
memlink status     # confirm it's running
```

The daemon is per-session (dies when the session ends). For a permanent setup, use your OS service manager — see [installation.md](installation.md#running-the-server).
