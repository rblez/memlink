# AGENTS.md

## Commands

```bash
bun install              # install deps (no lockfile committed — bun.lock is .gitignored)
npm run build            # builds dist/cli/index.js + dist/server/index.js (also type-checks via tsc --noEmit)

npm run dev:server       # bun --watch src/server/index.ts (Ctrl+L toggles request logging)
npm run dev:cli          # bun src/cli/index.ts  (same as npm run cli)

npm run test             # bun test
npm run lint             # eslint src --ext .ts
npm run format           # prettier --write "src/**/*.ts" "tests/**/*.ts"
npm run format:check     # prettier --check (CI gate)
```

All commands use **Bun** (`bun install`, `bun build`, `bun test`). The built output targets Node (`dist/`). Source imports use `.ts` extensions (Bun resolves them, tsc tolerates with `allowImportingTsExtensions`).

## CI pipeline order (`.github/workflows/ci.yml`)

`bun test` → `bun run build` (type check) → `bun run format:check` → `bun run lint` → `bun run build` (again)

## Project Structure

```
src/
├── cli/index.ts       # CLI entrypoint (commander, all subcommands)
├── server/index.ts    # Express + @modelcontextprotocol/sdk (MCP over streamable HTTP)
├── core/
│   ├── memory.ts      # File I/O, CRUD, search, export/import, backup, bulk ops
│   ├── types.ts       # Types, constants (MEMLINK_VERSION, DEFAULT_PORT, KNOWN_AGENTS)
│   ├── scaffold.ts    # Agent configs, MCP config/skill/AGENTS.md scaffolding
│   └── sync.ts        # Native agent memory sync
└── update/            # Self-update (check latest release, download binary)
tests/
├── memory.test.ts     # Core memory unit tests (createUniversalMemory, CRUD, search)
├── server.test.ts     # MCP server integration tests (health, auth, protocol)
└── unit.test.ts       # Additional unit tests (edge cases, multiline, special chars)
```

## Architecture

```
User → CLI → Core → ~/.memlink/*.memory.md
Agent → MCP Server → Core → ~/.memlink/*.memory.md
```

Config: `~/.memlink/config.json`. Memory files: `~/.memlink/<memoryId>.memory.md` (book format: `# Memoria: name`, `## Indice`, numbered entries).

## Testing

Tests use `bun:test` and create real memory files in `~/.memlink/` (cleaned up in `afterEach`). No mocks — tests hit actual disk I/O.

## Key details

- **MCP auth**: `?mem_id=<12-char-id>` (preferred) or `Authorization: Bearer <token>` (legacy fallback)
- **Global `--json` flag**: all CLI commands support `--json` for scripting
- **Supported agents**: 6 in `src/core/scaffold.ts` — windsurf, cursor, claude, codex, opencode, devin
- **`KNOWN_AGENTS`** in `src/core/types.ts:64` is separate from scaffold agents (used for CLI init only)
- **TypeScript**: strict mode (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` all on)
- **ESLint**: modern flat config (`eslint.config.js`). Legacy `.eslintrc.js` still present but unused by `npm run lint`
- **Format**: Prettier (semi, singleQuote, printWidth 100, tabWidth 2, no tabs)
- **Changelog**: No CHANGELOG — git tags drive releases. PRs target `beta` branch, merges to `main` trigger release on `v*` tags.
- **Publishing manual**: `npm publish --access public` desde máquina local (Windows). CI solo corre checks.

@.agents/skills/memlink
