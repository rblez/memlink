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
memlink serve --watch                 # Auto-export on file changes
```

Options:

- `--port <port>` — Port to listen on (default: 4444, env: `MEMLINK_PORT` or `PORT`)
- `--host <host>` — Host to bind to (default: localhost, env: `MEMLINK_HOST` or `HOST`)
- `--cors <origins>` — CORS allowed origins (comma-separated or `*`)
- `--read-only` — Disable write operations
- `--daemon` — Run server in background. Use `memlink stop` to stop
- `--log-level <level>` — Log level: `none`, `basic` (default in TTY), or `verbose`
- `--transport <transports>` — Transports: `auto`, `http`, `sse`, `stdio` (comma-separated)
- `--memory <name-or-id>` — Memory to serve (required for stdio transport)
- `--watch` — Watch memory files for changes and auto-export to formats

### `memlink init <name>`

Create a new memory. Alias: `create`.

```bash
memlink init my-project
memlink init my-project --serve
memlink init my-project --serve --port 4444
```

Name restrictions: only letters, numbers, `-`, `_`, `.`. No duplicates allowed.

Options:

- `--serve` — Auto-start the MCP server after creation
- `--port <port>` — Port for auto-start server

### `memlink ls`

List all memories with name, ID, and size.

```bash
memlink ls
```

### `memlink show <name-or-id>`

Show memory contents as consolidated Markdown. Also exports to configured formats.

```bash
memlink show my-project
memlink show abc123def456
```

### `memlink info <name-or-id>`

Show memory details: name, ID, MCP URL, entries count, size, tags, dates.

```bash
memlink info my-project
memlink info abc123def456
```

### `memlink export <name-or-id>`

Export memory to configured formats (md, txt, html, json) without showing content.

```bash
memlink export my-project
```

Formats are written to `~/.memlink/formats/`. Configurable via `exportFormats` in config.

### `memlink import <name-or-id> <file>`

Import entries from a JSON file. The file can be an array of entries or an object with an `entries` key.

```bash
memlink import my-project ./backup.json
memlink import my-project ./entries.json --overwrite
```

Each entry must have `title` and `content`. Optional: `tags`. Existing entries with the same title are skipped unless `--overwrite` is used.

Options:

- `--overwrite` — Replace existing entries with matching titles

### `memlink connect <name-or-id>`

Show MCP config JSON and setup instructions for all major agents.

```bash
memlink connect my-project
memlink connect my-project --all
```

Options:

- `--all` — Show all known agents, not just detected ones

### `memlink config`

View or modify configuration.

```bash
memlink config                    # View full config
memlink config get exportFormats  # Get a specific key
memlink config set exportFormats '["md","html"]'  # Set a value
```

### `memlink delete <name-or-id>`

Permanently delete a memory and its data file.

```bash
memlink delete my-project
memlink delete abc123def456
```

### `memlink stop`

Stop the Memlink daemon server running in the background.

```bash
memlink stop
```

### `memlink status`

Check if the Memlink daemon server is running.

```bash
memlink status
```

### `memlink skill`

Install the Memlink agent skill for OpenCode.

```bash
memlink skill                  # Install in .agents/skills/memlink/
memlink skill --global         # Install globally in ~/.agents/
memlink skill -g               # Short flag for global
```

### `memlink bug`

Open GitHub to report a bug or send feedback.

```bash
memlink bug
```

## Configuration

Config file at `~/.memlink/settings.json`:

```json
{
  "version": "1.0.12",
  "baseDir": "/home/user/.memlink",
  "universalMemories": [...],
  "serverPort": 4444,
  "serverHost": "localhost"
}
```

## Environment Variables

| Variable                | Description            | Default      |
| ----------------------- | ---------------------- | ------------ |
| `MEMLINK_DIR`           | Data directory         | `~/.memlink` |
| `MEMLINK_PORT` / `PORT` | Server port            | `4444`       |
| `MEMLINK_HOST` / `HOST` | Server host            | `localhost`  |
| `MEMLINK_NO_COLOR`      | Disable colored output | —            |
