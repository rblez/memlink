# Source Directory

TypeScript source code for memlink.

## Structure

```
src/
├── cli/          # Command-line interface
── core/         # Core business logic
├── server/       # MCP server
└── update/       # Self-update module
```

## Directories

### [cli/](./cli/)

CLI entrypoint. All user commands defined with Commander.js.

**Key file:** `index.ts` — commands: `init`, `create`, `serve`, `connect`, `status`, `memory list`, `memory show`, `bug`

### [core/](./core/)

Business logic: memory CRUD, search, backup, bulk ops, config management.

**Key files:**
- `memory.ts` — file I/O, CRUD, search, export/import, backup
- `types.ts` — TypeScript interfaces, constants (`MEMLINK_VERSION`, `DEFAULT_PORT`)
- `scaffold.ts` — agent configs, skill scaffolding

### [server/](./server/)

MCP server via Express + `@modelcontextprotocol/sdk`. Exposes memory tools to AI agents.

**Key file:** `index.ts` — server setup, auth (`?id=MEMORY_ID`), tools, resources

### [update/](./update/)

Self-update: checks latest release, downloads binary for current platform.

## Build

Compiles to `dist/` (targets Node):

```bash
bun run build          # Build + type check (tsc --noEmit)
npm run build:binaries # Standalone binaries (bun build --compile)
```

## Development

```bash
bun run dev:server     # bun --watch src/server/index.ts
bun run dev:cli        # bun src/cli/index.ts
```

## Architecture

Layered approach:

1. **CLI** (`cli/`) — user interface, command parsing, output formatting
2. **Core** (`core/`) — business logic, data persistence, memory management
3. **Server** (`server/`) — MCP protocol, agent communication

Data flow:

```
User → CLI → Core → ~/.memlink/*.memory.json
Agent → MCP Server → Core → ~/.memlink/*.memory.json
```
