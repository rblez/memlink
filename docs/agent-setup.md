# Agent Setup Guide

Memlink works with any MCP-compatible agent. Here's how to configure each one.

## Configuration format

All agents accept an MCP server configuration. The base format is:

```json
{
  "mcpServers": {
    "memlink": {
      "url": "http://localhost:4444/mcp?id=YOUR_MEMORY_ID"
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
   - URL: `http://localhost:4444/mcp?id=YOUR_MEMORY_ID`

## Windsurf

1. Open Windsurf settings
2. Navigate to MCP Server configuration
3. Add the memlink URL

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
3. Add the MCP server URL to your opencode.json or agent configuration

## Claude Code

Claude Code supports MCP servers. Add the URL to your Claude Code configuration.

## Cline (VS Code extension)

1. Open VS Code
2. Go to Cline extension settings → MCP Servers
3. Add:
   ```json
   {
     "mcpServers": {
       "memlink": {
         "url": "http://localhost:4444/mcp?id=YOUR_MEMORY_ID"
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
