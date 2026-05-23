# CLI

Command-line interface for memlink. Built with Commander.js.

## Entry Point

`index.ts` — all command definitions, output formatting.
`output.ts` — color palette, badge helpers, ASCII art, skill templates.

## Commands

### `memlink` (root)

Show system overview: server URL, memory list, total entries, disk size, available commands.

### `memlink init <name>` (alias `i`)

Create a new memory.

- `<name>` is **required** — exits with error if missing
- Creates memory file at `~/.memlink/<id>.memory.json`
- Copies MCP URL to clipboard (TTY only)
- Flags: `-s, --serve` auto-start server, `-p, --port <port>` for auto-started server

### `memlink create <name>` (alias `c`)

Alias for `init`. Identical behavior.

### `memlink serve` (alias `s`)

Start the MCP server.

- Default: `http://localhost:4444/mcp`
- Logs always on (no toggle flag)
- Shows all memory URLs on startup
- Flags: `-p, --port <port>`, `-H, --host <host>`

### `memlink connect <memoryId>` (alias `con`)

Get MCP connection details for a specific memory.

- Shows URL, MCP JSON config
- Copies URL to clipboard (TTY only)
- No `navFooter`

### `memlink ls` (alias `list`)

List all memories in a table: Name, ID, Size (KB). Top-level command (not nested under `memory`).

### `memlink show <memoryId>` (alias `sh`)

Show full memory contents as consolidated Markdown. No filter flags — prints the raw Markdown as agents see it. No `navFooter`.

### `memlink bug` (alias `feedback`)

Opens GitHub issue form with pre-filled template. Prompts **Enter** before opening browser (TTY only).

## TTY Detection

The CLI detects non-TTY environments (`process.stdout.isTTY`):

- ASCII art banners (`printLogo`) are skipped
- Clipboard operations are skipped
- Interactive prompts in `bug` are skipped (shows URL instead)

This enables silent operation in CI, Docker, pipes, and scripts.

## Output

### Branding

- Logo: braille art with gradient (`#00E5A0 → #FFFFFF → #CC00CC`)
- Symbols: `● ○ ❯  ─ * ↓ ↑ ↵` (no emojis)
- Colors: `primary (#00E5A0)`, `accent (#CC00CC)`, `muted (#66B8A0)`, `white (#e8e8e8)`, `dim (#444)`

### Nav Footer

Only on `serve`:

```
  ────────────────────────────────────────────────────────────────
  ^c stop
```

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `MEMLINK_DIR` | `memlink`, `connect`, `init`, `ls`, `show` | Override data directory |
| `MEMLINK_PORT` / `PORT` | `memlink`, `connect`, `init -s` | Default server port |
| `MEMLINK_HOST` / `HOST` | `memlink`, `connect`, `init -s` | Default server host |

## Dependencies

- `commander` — CLI framework
- `chalk` — terminal colors
- `table` — table formatting

The `readline` module (Node built-in) is used for the `bug` command's Enter prompt.

## Usage

```bash
# Build
npm run build

# Run
node dist/cli/index.js --help
node dist/cli/index.js init my-project
node dist/cli/index.js serve
```

## Dev

```bash
bun run dev:cli
```
