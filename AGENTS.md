# AGENTS.md

## Commands

```bash
bun install              # install deps (no lockfile — bun.lock is .gitignored)
npm run build            # builds dist/cli/index.js + dist/server/index.js (type-checks via bun build)
npm run dev:server       # bun --watch src/server/index.ts
npm run dev:cli          # bun src/cli/index.ts
npm run web:build        # bun build src/web-server/index.ts --outdir dist/web-server --target node
npm run web:dev          # bun src/web-server/index.ts (also: WEB_PORT=3000)
npm run test             # bun test (single: bun test tests/memory.test.ts)
npm run lint             # eslint src --ext .ts
npm run format           # prettier --write "src/**/*.ts" "tests/**/*.ts"
npm run format:check     # prettier --check (CI gate)
```

All tooling uses **Bun** (`bun install`, `bun build`, `bun test`). Built output targets Node (`dist/`). Source imports use `.ts` extensions (Bun resolves them, tsc tolerates via `allowImportingTsExtensions`). Build produces two separate bundles: `dist/cli/index.js` and `dist/server/index.js`.

## CI pipeline (`.github/workflows/ci.yml`)

`bun test` → `bun run build` (typecheck + build) → `bun run format:check` → `bun run lint` → `bun run build` (artifact)

## Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `MEMLINK_DIR` | `~/.memlink` | Data directory |
| `MEMLINK_PORT` / `PORT` | `4444` | Server port |
| `MEMLINK_HOST` / `HOST` | `localhost` | Bind address |
| `MEMLINK_BEARER_TOKEN` | — | Bearer token auth for MCP (`--bearer-token` flag also) |
| `MEMLINK_NO_COLOR` | — | Disable ANSI colors |

## Project structure

```
src/
├── cli/index.ts       # CLI entrypoint (commander)
├── cli/output.ts      # Output formatting, colors, branding, skill template
├── web-server/
│   ├── index.ts       # Express REST API + React static file server (web mode)
│   └── api.ts         # REST API wrapping all core/memory.ts functions
├── server/index.ts    # Express + @modelcontextprotocol/sdk (MCP over streamable HTTP + SSE)
├── core/
│   ├── memory.ts      # File I/O, CRUD, search, export/import, backup, bulk ops
│   └── types.ts       # Types, constants
web/
├── src/
│   ├── main.tsx       # React entrypoint (Vite)
│   ├── App.tsx        # SPA router + nav
│   ├── api.ts         # Typed API client for REST endpoints
│   └── pages/
│       ├── Dashboard.tsx   # System overview (memlink default)
│       ├── Memories.tsx    # List + create/delete memories (memlink ls/init/delete)
│       ├── MemoryView.tsx  # Entries CRUD + export + sync (memlink show)
│       ├── EntryEdit.tsx   # Create/update entry (memory_edit)
│       ├── Search.tsx      # Search across memories (memory_search)
│       ├── BulkDelete.tsx  # Bulk delete by titles/tags/pattern (bulk_delete)
│       ├── Backups.tsx     # Backup management (backup_create/list/restore/delete)
│       ├── Server.tsx      # Server config info
│       └── Config.tsx      # View/edit config (memlink config)
tests/
├── memory.test.ts     # Core memory unit tests
├── server.test.ts     # MCP server integration tests
└── unit.test.ts       # Edge cases, multiline, special chars
```

## Architecture

```
User → CLI → Core → ~/.memlink/*.memory.json
Agent → MCP Server → Core → ~/.memlink/*.memory.json
User → Web UI (React) → REST API → Core → ~/.memlink/*.memory.json
```

Config: `~/.memlink/config.json`. Memory files are JSON arrays of entries. Server listens at `http://localhost:4444/mcp?id=<memory-id>`. Web server runs at `http://localhost:3000/api`.

All commands that take `<name-or-id>` (`show`, `info`, `connect`, `delete`) accept either memory ID or memory name (case-insensitive).

## Key details

- **Server daemon**: `memlink serve --daemon` runs in background; `memlink stop` / `memlink status` to manage
- **Log levels**: `--log-level none|basic|verbose` for `serve` (default: basic in TTY, none otherwise)
- **MCP auth**: `?id=<memory-id>` in query string (`--bearer-token` / `MEMLINK_BEARER_TOKEN` also supported for HTTP transports)
- **TypeScript**: strict mode (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- **ESLint**: flat config (`eslint.config.js`), ignores `.eslintrc.js` + `dist/` + test files
- **Format**: Prettier (semi, singleQuote, printWidth 100, tabWidth 2, no tabs)
- **Testing**: `bun:test`, real disk I/O via `process.env.MEMLINK_DIR` (temp dir), cleaned in `afterEach`
- **Releases**: PRs target `beta`, merge to `main` triggers release on `v*` tags. No CHANGELOG.
- **Publishing**: Manual `npm publish --access public` from local machine. CI only runs checks.

@.agents/skills/memlink
