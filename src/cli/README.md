# CLI

Command-line interface for memlink. Built with Commander.js.

## Entry Point

`index.ts` — all command definitions, output formatting, interactive prompts.

## Commands

### `memlink init [name]`

Create a new memory. If `name` is not provided, prompts interactively.

- Creates memory file at `~/.memlink/<id>.memory.json`
- Auto-installs skill at `~/.agents/skills/memlink/` (global)
- Copies MCP URL to clipboard
- Only command with interactive TUI

### `memlink create [name]`

Alias for `init`.

### `memlink serve [-p port] [-H host]`

Start the MCP server.

- Default: `http://localhost:4444/mcp`
- Logs always on (no toggle flag)
- Shows all memory URLs on startup

### `memlink connect <memoryId>`

Get MCP connection details for a specific memory.

- Requires memory ID (list with `memlink memory list`)
- Shows URL, MCP JSON config
- Auto-installs skill at `~/.agents/skills/memlink/`
- Copies URL to clipboard

### `memlink status`

Show system status: server URL, memory count, total entries, total size.

### `memlink memory list`

List all memories in a table: Name, ID, Size.

### `memlink memory show <memoryId>`

Show memory contents.

| Flag | Description |
|------|-------------|
| (none) | Show full memory content |
| `--entries` | List all entries numbered |
| `--title <t>` | Show specific entry |

### `memlink bug`

Alias: `feedback`. Opens GitHub issue form in browser with pre-filled template.

## Output

### Branding

- Logo: braille art with gradient (`#00E5A0 → #FFFFFF → #CC00CC`)
- Symbols: `● ○ ❯  ─ * ↓ ↑ ↵` (no emojis)
- Colors: `primary (#00E5A0)`, `accent (#CC00CC)`, `muted (#66B8A0)`, `white (#e8e8e8)`, `dim (#444)`

### Nav Footer

Only on `init`, `serve`, `status`:

```
  ────────────────────────────────────────────────────────────────
  ^c exit  ·  ^c stop
```

## Dependencies

- `commander` — CLI framework
- `chalk` — terminal colors
- `table` — table formatting
- `readline` — interactive prompts (init only)

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
npx tsx src/cli/index.ts --help
bun run dev:cli
```
