# Copilot Instructions for Memlink

## Build, Test, and Lint

### Commands
```bash
bun install              # Install dependencies (bun.lock is .gitignored)
npm run build            # Build dist/cli/index.js and dist/server/index.js (also type-checks)
npm run dev:server       # Server with hot reload (bun --watch src/server/index.ts)
npm run dev:cli          # CLI dev mode (bun src/cli/index.ts)
npm run test             # Run all tests (bun test)
npm run test:watch       # Watch mode for tests
npm run lint             # ESLint on src/
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier --write
npm run format:check     # Prettier check (CI gate)
```

### Single Test Example
```bash
bun test tests/memory.test.ts
```

### CI Pipeline Order
`bun test` → `bun run build` (typecheck) → `bun run format:check` → `bun run lint` → `bun run build`

## Architecture

### Overview
Memlink is a self-hosted MCP (Model Context Protocol) server for AI agent memory. Two main entry points:

```
User/CLI → dist/cli/index.js → Core Storage → ~/.memlink/<memory-name>/
Agent   → dist/server/index.js (MCP server) → Core Storage
```

### Core Layers

**CLI Layer** (`src/cli/index.ts`):
- Commander-based command handler
- Commands: `init`, `serve`, `show`, `add`, `search`, `export`, `import`, etc.
- TTY detection for conditional output (ASCII art, colors, clipboard)

**Server Layer** (`src/server/index.ts`):
- Express + MCP SDK (streamable HTTP + SSE transport)
- Listens at `http://localhost:4444/mcp?id=<memory-id>`
- MCP tools: `memory_read`, `memory_edit`, `memory_search`, `memory_sync`
- Optional authentication via `?id=<memory-id>` query param

**Core Storage** (`src/core/`):
- **storage.ts**: Index + per-entry CRUD, frontmatter serialization, auto-backups
- **lock.ts**: File-level locking (TTL 10s) with `withLock()` helper for concurrent writes
- **memory.ts**: Legacy memory API, config helpers, CLI utilities
- **types.ts**: Shared interfaces, constants, path helpers

### Storage Layout
```
~/.memlink/
├── settings.json              # Global config
├── .serve.pid                 # Daemon PID
└── <memory-name>/
    ├── .lock                  # Write lock
    ├── index.json             # Index (metadata only)
    ├── 1.md, 2.md, ...        # Entries (frontmatter + markdown)
    └── .backups/              # Auto-backups on every write
```

## Key Conventions

### TypeScript Strictness
- Strict mode enabled (noUnusedLocals, noUnusedParameters, noImplicitReturns, noFallthroughCasesInSwitch)
- ESLint enforces const over let, warns on `any` types
- Use `_` prefix for intentionally unused params/vars (e.g., `_error`, `_unused`)

### Tooling
- **Bun** for building, testing, dev (`bun install`, `bun test`, `bun --watch`)
- **Prettier**: semi, singleQuote, printWidth 100, tabWidth 2, no tabs
- **ESLint**: Flat config (`eslint.config.js`), ignores `.eslintrc.js`, `dist/`, tests

### Storage & Locking
- Entry files use frontmatter format (YAML metadata + markdown content)
- All writes serialized via `.lock` file with 10s TTL (prevents concurrent corruption)
- `withLock(memoryName, callback)` helper in `src/core/lock.ts` for safe writes
- Auto-backups created on every write to `.backups/<id>_<timestamp>.md`

### Memory Name/ID Flexibility
- Commands accepting `<name-or-id>` (`show`, `info`, `connect`, `delete`) handle both
- Memory IDs are used internally; names are user-friendly aliases

### TTY Detection
```typescript
const isTTY = process.stdout.isTTY && process.stdin.isTTY;
```
- Conditionally disable ASCII art, colors, and clipboard in non-TTY (CI, Docker, pipes)
- Clipboard failures are silently handled

### Output Formatting
- Uses `chalk` for colors (see `src/cli/output.ts`)
- Branded headers and status badges
- Table output via `table` package

### Testing Patterns
- Test framework: `bun:test` (Bun native)
- Real disk I/O: tests write to `process.env.MEMLINK_DIR` (auto temp dir)
- Cleanup: `afterEach` removes test directories
- MCP server integration tests in `server.test.ts`

## Environment Variables
- `MEMLINK_DIR` — Data directory (default: `~/.memlink`)
- `MEMLINK_PORT` / `PORT` — Server port (default: 4444)
- `MEMLINK_HOST` / `HOST` — Server host (default: localhost)

## Release Process
- PRs target `beta`, merge to `main` triggers release on `v*` tags
- Publish manually: `npm publish --access public`
- No CHANGELOG maintained (releases automated)
