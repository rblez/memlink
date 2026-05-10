# AGENTS.md - Memlink Developer Guide

## Commands

```bash
# Build (always before running dist) - uses bun build
npm run build

# Build platform binaries (macOS, Linux, Windows)
npm run build:binaries

# Dev with hot reload
npm run dev:server    # MCP server on localhost:4444
npm run dev:cli      # CLI in dev mode (runs via tsx/bun)

# Run built version
npm run start        # node dist/server/index.js
npm run cli         # node dist/cli/index.js
```

## Project Structure

```
src/
├── cli/index.ts      # CLI commands (init, agent, memory, skill, config)
├── server/index.ts  # MCP server using @modelcontextprotocol/sdk
└── core/
    ├── memory.ts    # Business logic: file I/O, parsing, search
    └── types.ts   # Types, constants, KNOWN_AGENTS registry
```

## Order of Operations

1. `build` before any `dist/` execution
2. `dev:cli` runs via `tsx` (no build needed)
3. `dev:server` watches for file changes

## Runtime Storage

User data lives in `~/.memlink/` (not in repo):
- `config.json` - global config + agent registry
- `*.memory` - indexed memory files per agent

## Agent Types

11 known agents in `src/core/types.ts:57` with specific skill paths:
- windsurf, cursor, claude, codex, goose, opencode, kimi, qwen, copilot, amp, custom

## MCP Server

- URL: `http://localhost:4444/mcp`
- Auth: `Authorization: Bearer memlink_<token>`
- Uses @modelcontextprotocol/sdk

## Testing

Tests use Bun's test runner (`bun test`). Test files in `tests/` directory.
- `bun test` - run tests
- `bun test --watch` - watch mode

## Distribution

Not published to npm. Users install via:
- `curl -sL rblez.com/memlink/install.sh | bash` (interactive)
- Manually from GitHub Releases