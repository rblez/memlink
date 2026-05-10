# Source Directory

This directory contains all the TypeScript source code for Memlink.

## Structure

```
src/
├── cli/          # Command-line interface implementation
├── core/         # Core business logic and data management
└── server/       # MCP server implementation
```

## Directories

### [cli/](./cli/)

Command-line interface implementation. Handles all user commands like `memlink init`, `memlink agent create`, `memlink serve`, etc.

**Key files:**
- `index.ts` - Main CLI entry point with all command definitions

### [core/](./core/)

Core business logic for memory management, configuration, and data persistence.

**Key files:**
- `memory.ts` - Memory operations (read, write, search, export, import)
- `types.ts` - TypeScript type definitions and constants

### [server/](./server/)

MCP (Model Context Protocol) server implementation that exposes memory tools to AI agents.

**Key files:**
- `index.ts` - MCP server setup with tools and resources

## Build

All TypeScript files compile to the `../dist/` directory:

```bash
bun run build
```

## Development

Run in development mode with hot reload:

```bash
bun run dev:server  # Server with hot reload
bun run dev:cli     # CLI in dev mode
```

## Architecture

The architecture follows a layered approach:

1. **CLI Layer** (`cli/`) - User interface, command parsing, output formatting
2. **Core Layer** (`core/`) - Business logic, data persistence, memory management
3. **Server Layer** (`server/`) - MCP protocol implementation, agent communication

Data flow:
```
User → CLI → Core → Memory Files
Agent → MCP Server → Core → Memory Files
```
