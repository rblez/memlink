# Server Directory

MCP (Model Context Protocol) server implementation that exposes memory tools to AI agents.

## Files

### [index.ts](./index.ts)

MCP server setup with tools and resources. Implements the Model Context Protocol for agent communication.

**Purpose:**
- Create and configure MCP server
- Expose memory tools to AI agents
- Provide resources for agent instructions
- Handle authentication via bearer tokens

**Key Components:**

#### Server Setup
- `buildMcpServer(agentId, agentName)` - Create MCP server instance for specific agent
- `startServer()` - Start HTTP server with MCP transport

#### Authentication Middleware
- `extractToken(req)` - Extract bearer token from HTTP headers
- Auth middleware validates tokens on each request

#### MCP Tools

**1. memory_read**
- Read all memory entries or a specific one by title
- Parameters: `title` (optional)
- Returns: Memory entries with content

**2. memory_edit**
- Create or update a memory entry
- Parameters: `title`, `content`, `tags` (optional)
- Returns: Success confirmation

**3. memory_delete**
- Delete a memory entry by title
- Parameters: `title`
- Returns: Success confirmation

**4. memory_sync**
- Sync and validate memory integrity
- Parameters: none
- Returns: Memory statistics

**5. memory_search**
- Search entries by query (title, content, tags)
- Parameters: `query`
- Returns: Matching entries

**6. memory_batch**
- Create/update multiple entries at once
- Parameters: `entries` (array of {title, content, tags})
- Returns: Success confirmation

#### MCP Resources

**1. memlink://instructions**
- Agent rules system prompt
- Returns: Instructions for how agents should use memory
- Content includes:
  - Read memory at session start
  - Save important information automatically
  - Detect memory commands ("save X", "remember that", "forget X")
  - Keep memory organized
  - Update existing entries

**2. memlink://agents**
- List all registered agents
- Returns: JSON array of agent information
- Includes: agentId, agentName, createdAt, lastSeen

#### Server Configuration

```typescript
// Default configuration
const PORT = 4444;
const HOST = 'localhost';

// Can be customized via:
// - CLI flags: --port, --host
// - Config file: ~/.memlink/config.json
```

**HTTP Endpoints:**

- `POST /mcp` - MCP protocol endpoint
- All requests require `Authorization: Bearer <token>` header

**Dependencies:**
- `express` - HTTP server framework
- `@modelcontextprotocol/sdk` - MCP SDK
- `zod` - Schema validation for tool parameters

## Usage

```bash
# Start server (default)
node bin/memlink.js serve

# Start with custom port/host
node bin/memlink.js serve --port 4445 --host 0.0.0.0

# Server will start on:
# http://localhost:4444/mcp
```

## Agent Connection

Agents connect via MCP configuration:

```json
{
  "mcpServers": {
    "memlink": {
      "serverUrl": "http://localhost:4444/mcp",
      "headers": {
        "Authorization": "Bearer memlink_YOUR_TOKEN"
      }
    }
  }
}
```

## Protocol Flow

1. **Agent sends request** → HTTP POST to `/mcp`
2. **Auth middleware** → Validates bearer token
3. **MCP transport** → Routes to appropriate tool
4. **Tool execution** → Performs memory operation
5. **Response** → Returns result to agent

## Error Handling

- Invalid token → 401 Unauthorized
- Missing token → 401 Unauthorized
- Invalid parameters → Tool error response
- Memory not found → Tool error response
- Server errors → Logged to console

## Development

```bash
# Run in dev mode with hot reload
npm run dev:server

# Test server
curl -X POST http://localhost:4444/mcp \
  -H "Authorization: Bearer memlink_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Security

- Bearer token authentication required for all requests
- Tokens are unique per agent (`memlink_<32char>`)
- Server binds to localhost by default (not exposed to network)
- Can bind to 0.0.0.0 for network access (use with caution)

## MCP Protocol Details

The server implements the Model Context Protocol (MCP) specification:

**Transport:** Streamable HTTP
**Protocol Version:** 2024-11-05
**Capabilities:**
- Tools (6 available)
- Resources (2 available)

**Tool Schema:**
Each tool defines:
- `name` - Tool identifier
- `description` - Tool purpose
- `inputSchema` - Zod schema for parameters

**Resource Schema:**
Each resource defines:
- `uri` - Resource identifier (e.g., `memlink://instructions`)
- `name` - Display name
- `mimeType` - Content type (application/json)

## Logging

Server logs to console:
- Startup message with URL
- Agent connections
- Tool invocations (in verbose mode)
- Errors and warnings

## Performance

- Stateless design (no server-side sessions)
- Memory files loaded on-demand
- Efficient parsing with line-based indexing
- Minimal memory footprint
