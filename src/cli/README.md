# CLI

Command-line interface for memlink. Built with Commander.js.

## Entry Point

`index.ts` — all command definitions, output formatting.
`output.ts` — color palette, badge helpers, ASCII art, skill templates.

## Commands

### `memlink init <name>` (alias `create`)

Create a new memory.

- `<name>` is **required**
- Creates `~/.memlink/<name>/index.json` (per-memory directory)
- Flags: `--serve` auto-start server, `--port <port>` for auto-started server

### `memlink serve`

Start the MCP server.

- Default: `http://localhost:4444/mcp`
- Flags: `--port <port>`, `--host <host>`, `--daemon`, `--cors <origins>`, `--read-only`, `--log-level <level>`, `--bearer-token <token>`, `--transport <transports>`, `--memory <name-or-id>`, `--wslink`
- Daemon mode: `memlink serve --daemon` runs in background, managed via `memlink stop` / `memlink status`

### `memlink ls`

List all memories: Name, ID, Size.

### `memlink show <name-or-id>`

Show memory contents as Markdown.

### `memlink info <name-or-id>`

Show memory details: entries, tags, created/last-seen timestamps.

### `memlink export <name-or-id>`

Export memory as JSON to `~/.memlink/exports/<name>.json`.

### `memlink import <name-or-id> <file>`

Import entries from a JSON file.

- Flags: `--overwrite` overwrite existing entries with the same title

### `memlink delete <name-or-id>`

Delete an entire memory (config entry + storage directory).

### `memlink connect <name-or-id>`

Show MCP connection details for an agent. Supports streamable HTTP, SSE, and stdio.

### `memlink config [get/set]`

View or modify `settings.json`.

- Example: `memlink config get serverPort`, `memlink config set serverPort 5555`.

### `memlink doctor`

Run diagnostics: config file, data directory, server health, Node version, platform.

### `memlink skill`

Install memlink agent skill to `~/.agents/skills/memlink/SKILL.md`.

### `memlink stop` / `memlink status`

Stop the daemon or check if it's running.

### `memlink bug`

Opens GitHub issue form.

## TTY Detection

The CLI detects non-TTY environments:

- ASCII art banners are skipped
- Clipboard operations are skipped
- Interactive prompts are skipped

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MEMLINK_DIR` | Override data directory (`~/.memlink`) |
| `MEMLINK_PORT` / `PORT` | Server port (4444) |
| `MEMLINK_HOST` / `HOST` | Server host (localhost) |
| `MEMLINK_BEARER_TOKEN` | Bearer token for MCP endpoints |

## Data Layout

```
~/.memlink/
├── settings.json          # Global config
├── .serve.pid             # Daemon PID (hidden)
│
└── my-memory/             # Per-memory directory
    ├── index.json         # Index (titles, tags, timestamps)
    ├── 1.json             # Entry 1 (full content)
    ├── 2.json             # Entry 2
    │
    └── .backups/          # Auto-backups on every write
```

## Output

### Branding

- Logo: braille art with gradient (`#00E5A0 → #FFFFFF → #CC00CC`)
- Symbols: `● ○ ❯  ─` (no emojis)
- Colors: `primary (#00E5A0)`, `accent (#CC00CC)`, `muted (#66B8A0)`, `white (#e8e8e8)`, `dim (#444)`

## Usage

```bash
# Dev
bun run dev:cli

# Build
npm run build
node dist/cli/index.js --help
```
