# CLI Reference

## Global flags

| Flag            | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `-v, --version` | Show version with runtime info (Node, platform, config path)     |
| `-h, --help`    | Show help with all commands, examples, and environment variables |

## Commands

### `memlink`

Show system overview: server URL, memories list, total entries/size, essentials.

```bash
memlink
```

### `memlink serve`

Start the MCP server. Supports Streamable HTTP, SSE, and Stdio transports.

```bash
memlink serve
memlink serve --port 4444
memlink serve --host 0.0.0.0
memlink serve --cors "*"
memlink serve --read-only
memlink serve --daemon
memlink serve --daemon --log-level verbose
memlink serve --transport stdio --memory my-memory
```

Options:

- `--port <port>` — Port to listen on (default: 4444, env: `MEMLINK_PORT` or `PORT`)
- `--host <host>` — Host to bind to (default: localhost, env: `MEMLINK_HOST` or `HOST`)
- `--cors <origins>` — CORS allowed origins (comma-separated or `*`)
- `--read-only` — Disable write operations
- `--daemon` — Run server in background (cross-OS: Unix `detached: true` + `unref()`, Windows VBScript detach)
- `--log-level <level>` — Log level: `none`, `basic` (default in TTY), or `verbose`
- `--transport <transports>` — Transports: `auto`, `http`, `sse`, `stdio` (comma-separated)
- `--memory <name-or-id>` — Memory to serve (required for stdio transport)
- `--bearer-token <token>` — Require `Authorization: Bearer <token>` for MCP endpoints

### `memlink add <title> <content>`

Write an entry to the default memory (or `--memory`).

```bash
memlink add "First note" "Hello world"
memlink add "Project goals" "..." --tags project,goals --memory my-project
```

Options:

- `--memory <name>` — Target memory (default: `default`)
- `--tags <tags>` — Comma-separated tags

### `memlink entries`

List entries in the default memory (or `--memory`).

```bash
memlink entries
memlink entries --memory my-project --limit 20
```

### `memlink search <query>`

Search entries by title, content, or tags.

```bash
memlink search "project"
memlink search "goals" --memory my-project --limit 10
```

### `memlink url`

Show MCP config JSON for connecting agents to the default memory or a specific one.

```bash
memlink url
memlink url --memory my-project
```

### `memlink token [list|revoke]`

Manage memory tokens.

```bash
memlink token list
memlink token list --memory my-project
memlink token revoke <token>
```

### `memlink pause --memory <name>`

Suspend a memory in the running daemon (no restart needed).

```bash
memlink pause --memory my-project
```

### `memlink resume --memory <name>`

Resume a paused memory.

```bash
memlink resume --memory my-project
```

### `memlink stop [--memory <name>]`

Stop the daemon, or remove a specific memory from the running daemon.

```bash
memlink stop             # Stop the daemon
memlink stop --memory my-project  # Remove my-project from routing
```

### `memlink status`

Check if the Memlink daemon server is running.

```bash
memlink status
```

### `memlink info <name-or-id>`

Show memory details: name, ID, MCP URL, entries count, size, status, dates.

```bash
memlink info my-project
memlink info abc123def456
```

### `memlink delete <name-or-id>`

Permanently delete a memory and its data.

```bash
memlink delete my-project
memlink delete abc123def456
```

### `memlink export [name-or-id]`

Export memory to `.md` / `.json` / `.txt` formats.

```bash
memlink export my-project
```

### `memlink import <name-or-id> <file>`

Import entries from a JSON file.

```bash
memlink import my-project ./backup.json
memlink import my-project ./entries.json --overwrite
```

### `memlink config`

View or modify configuration.

```bash
memlink config                    # View full config
memlink config get exportFormats  # Get a specific key
memlink config set exportFormats '["md","html"]'  # Set a value
```

### `memlink skill`

Install the Memlink agent skill (e.g. for OpenCode).

```bash
memlink skill                  # Install in .agents/skills/memlink/
memlink skill --global         # Install globally in ~/.agents/
```

### `memlink connect`

Link CLI with memlink.cloud (Phase 2 — stub).

```bash
memlink connect
```

### `memlink disconnect`

Unlink from memlink.cloud (Phase 2 — stub).

```bash
memlink disconnect
```

## Configuration

Config file at `~/.memlink/settings.json`:

```json
{
  "version": "1.2.1",
  "baseDir": "/home/user/.memlink",
  "serverPort": 4444,
  "serverHost": "localhost"
}
```

Per-memory metadata in `~/.memlink/<name>/meta.json`:

```json
{
  "memoryId": "abc123def456",
  "memoryName": "my-project",
  "token": "...",
  "status": "active",
  "createdAt": "...",
  "lastServedAt": "..."
}
```

## Environment Variables

| Variable                | Description                     | Default      |
| ----------------------- | ------------------------------- | ------------ |
| `MEMLINK_DIR`           | Data directory                  | `~/.memlink` |
| `MEMLINK_PORT` / `PORT` | Server port                     | `4444`       |
| `MEMLINK_HOST` / `HOST` | Server host                     | `localhost`  |
| `MEMLINK_NO_COLOR`      | Disable colored output          | —            |
| `MEMLINK_DEBUG`         | Log VBScript path for debugging on Windows | —        |
