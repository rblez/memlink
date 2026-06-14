# CLI

Command-line interface for Memlink. Built with [Commander.js](https://github.com/tj/commander.js).

## Entry Points

- `index.ts` — all command definitions and registration
- `output.ts` — color palette, badge helpers, ASCII branding
- `admin.ts` — HTTP client for the daemon admin API
- `commands/` — one file per command

## Commands

| Command | File | Description |
|---------|------|-------------|
| `memlink` (default) | `index.ts` | System overview |
| `memlink serve` | `index.ts` | Start MCP server (foreground or daemon) |
| `memlink status` | `index.ts` | Check daemon health |
| `memlink stop` | `index.ts` | Stop daemon or remove memory from routing |
| `memlink add` | `commands/add.ts` | Write entry to default memory |
| `memlink edit` | `commands/edit.ts` | Edit an existing entry by ID |
| `memlink entries` | `commands/entries.ts` | List entries |
| `memlink search` | `commands/search.ts` | Search entries |
| `memlink url` | `commands/url.ts` | Show MCP URL and config JSON |
| `memlink token` | `commands/token.ts` | Generate, list, or revoke tokens |
| `memlink pause` | `commands/pause.ts` | Suspend a memory |
| `memlink resume` | `commands/pause.ts` | Resume a paused memory |
| `memlink connect` | `commands/cloud.ts` | Link with memlink.cloud |
| `memlink disconnect` | `commands/cloud.ts` | Unlink from memlink.cloud |

## Daemon Architecture

`memlink serve --daemon` spawns a detached child process:

- **Unix**: `child_process.spawn` with `detached: true` + `unref()`
- **Windows**: VBScript wrapper via `spawnDetached()` in `daemon.ts`

The child writes its own PID to `.serve.pid` after startup (via `--daemon-child` flag). The admin API (`/admin/*`) is protected by a local token and used by CLI commands (`pause`, `resume`, `stop --memory`) to communicate with the running daemon without a restart.

## TTY Detection

```ts
const isTTY = process.stdout.isTTY && process.stdin.isTTY;
```

When `false` (CI, Docker, pipes): ASCII banners, clipboard operations, and braille art are all suppressed.

## Output Helpers (`output.ts`)

```ts
ok(label, value?)    // green badge
err(msg)             // red badge
info(label, value)   // cyan label
kv(key, value)       // dim key + white value
dimLine(msg)         // muted single line
```

## Dev Usage

```bash
bun run dev:cli              # run CLI in dev mode
node dist/cli/index.js --help  # run built CLI
```
