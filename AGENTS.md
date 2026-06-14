# AGENTS.md

## Commands

```bash
bun install              # install deps (no lockfile)
npm run build            # builds dist/cli/index.js + dist/server/index.js (type-checks via tsc --noEmit)
npm run dev:server       # bun --watch src/server/index.ts
npm run dev:cli          # bun src/cli/index.ts
npm run test             # bun test (all tests)
npm run lint             # eslint src --ext .ts
npm run format           # prettier --write "src/**/*.ts" "tests/**/*.ts"
npm run format:check     # prettier --check (CI gate)
```

All tooling uses **Bun** (`bun install`, `bun build`, `bun test`). Built output targets Node (`dist/`). Source imports use `.ts` extensions (Bun resolves them, tsc tolerates via `allowImportingTsExtensions`).

## CI pipeline (`.github/workflows/ci.yml`)

`bun test` → `bun run build` → `bun run format:check` → `bun run lint` → `bun run build`

## Project structure

```
src/
├── cli/index.ts        # CLI entrypoint (commander)
├── cli/output.ts       # Colors, badges, branding
├── cli/admin.ts        # Daemon admin API client
├── cli/commands/       # One file per command (cloud.ts, etc.)
├── server/index.ts     # MCP server (Express + MCP SDK)
└── core/
    ├── storage.ts      # Entry CRUD, atomic writes, backups
    ├── meta.ts         # Per-memory meta.json
    ├── routing.ts      # Token → MemoryRoute map
    ├── health.ts       # Daemon heartbeat
    ├── auth.ts         # Admin token
    ├── lock.ts         # File lock with TTL
    ├── memory.ts       # Config + CLI helpers
    └── types.ts        # Types, constants, MEMLINK_VERSION
tests/
├── memory.test.ts      # Core memory unit tests
├── server.test.ts      # MCP server integration tests
├── unit.test.ts        # Edge cases, multiline, special chars
└── vbscript.test.ts    # Windows daemon VBScript tests
```

## Cloud

```bash
memlink connect   # device flow → memlink.cloud (default: https://memlink.cloud)
memlink disconnect
```

The CLI uses OAuth device flow (RFC 8628). It contacts `MEMLINK_CLOUD_URL`, gets a user code, prompts you to open a URL and authorize via GitHub. On success, the cloud token is saved in `settings.json`.

## Architecture

```
User → CLI → Core → ~/.memlink/<name>/ (index.json + content files)
Agent → MCP Server → Core → ~/.memlink/<name>/
CLI → device flow → memlink.cloud → GitHub OAuth → cloud token in settings.json
```

Config: `~/.memlink/settings.json`. Each memory is a directory with per-entry files. Server listens at `http://localhost:4444/mcp?id=<memory-id>`.

All commands that take `<name-or-id>` (`show`, `info`, `connect`, `delete`) accept either memory ID or memory name (case-insensitive).

## Key details

- **Current version**: 1.3.3 (`MEMLINK_VERSION` in `src/core/types.ts`, `version` in `package.json`)
- **Server daemon**: `memlink serve --daemon` runs in background; `memlink stop` / `memlink status` to manage
- **Log levels**: `--log-level none|basic|verbose` for `serve` (default: basic in TTY, none otherwise)
- **MCP auth**: `?id=<memory-id>` in query string (no Bearer token support)
- **TypeScript**: strict mode (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- **ESLint**: flat config (`eslint.config.js`), ignores `.eslintrc.js` + `dist/` + tests
- **Format**: Prettier (semi, singleQuote, printWidth 100, tabWidth 2, no tabs)
- **Testing**: `bun:test`, real disk I/O via `process.env.MEMLINK_DIR` (temp dir), cleaned in `afterEach`
- **Releases**: PRs target `beta`, merge to `main` triggers release on `v*` tags. No CHANGELOG.
- **Publishing**: Manual `npm publish --access public` from local machine. CI only runs checks.
- **Cloud repo**: `github.com/rblez/memlink.cloud` — Bun + TypeScript auth server (zero npm deps)

@.agents/skills/memlink
