# AGENTS.md

## Commands

```bash
bun install              # install deps (no lockfile — bun.lock is .gitignored)
npm run build            # builds dist/cli/index.js + dist/server/index.js (also type-checks via tsc --noEmit)
npm run dev:server       # bun --watch src/server/index.ts
npm run dev:cli          # bun src/cli/index.ts
npm run test             # bun test (single test: bun test tests/memory.test.ts)
npm run lint             # eslint src --ext .ts
npm run format           # prettier --write "src/**/*.ts" "tests/**/*.ts"
npm run format:check     # prettier --check (CI gate)
```

All tooling uses **Bun** (`bun install`, `bun build`, `bun test`). Built output targets Node (`dist/`). Source imports use `.ts` extensions (Bun resolves them, tsc tolerates via `allowImportingTsExtensions`).

## CI pipeline (`.github/workflows/ci.yml`)

`bun test` → `bun run build` (typecheck) → `bun run format:check` → `bun run lint` → `bun run build`

## Project structure

```
src/
├── cli/index.ts       # CLI entrypoint (commander)
├── cli/output.ts      # Output formatting, colors, branding, skill template
├── server/index.ts    # Express + @modelcontextprotocol/sdk (MCP over streamable HTTP + SSE)
├── core/
│   ├── storage.ts     # Index+N.json CRUD, auto-backups, migration
│   ├── lock.ts        # .lock with TTL + withLock helper
│   ├── memory.ts      # Legacy CRUD, CLI helpers, config
│   └── types.ts       # Types, constants, getMemlinkDir
tests/
├── memory.test.ts     # Core memory unit tests
├── server.test.ts     # MCP server integration tests
└── unit.test.ts       # Edge cases, multiline, special chars
```

## Architecture

```
User → CLI → Core → ~/.memlink/<name>/index.json + N.json
Agent → MCP Server → Core → ~/.memlink/<name>/index.json + N.json
```

Config: `~/.memlink/settings.json`. Each memory is a directory with per-entry files. Server listens at `http://localhost:4444/mcp?id=<memory-id>`.

All commands that take `<name-or-id>` (`show`, `info`, `connect`, `delete`) accept either memory ID or memory name (case-insensitive).

## Key details

- **Server daemon**: `memlink serve --daemon` runs in background; `memlink stop` / `memlink status` to manage
- **Log levels**: `--log-level none|basic|verbose` for `serve` (default: basic in TTY, none otherwise)
- **MCP auth**: `?id=<memory-id>` in query string (no Bearer token support)
- **TypeScript**: strict mode (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- **ESLint**: flat config (`eslint.config.js`), ignores `.eslintrc.js` + `dist/` + tests
- **Format**: Prettier (semi, singleQuote, printWidth 100, tabWidth 2, no tabs)
- **Testing**: `bun:test`, real disk I/O via `process.env.MEMLINK_DIR` (temp dir), cleaned in `afterEach`
- **Releases**: PRs target `beta`, merge to `main` triggers release on `v*` tags. No CHANGELOG.
- **Publishing**: Manual `npm publish --access public` from local machine. CI only runs checks.

@.agents/skills/memlink
