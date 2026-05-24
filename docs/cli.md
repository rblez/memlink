# CLI Reference

## Global flags

| Flag | Description |
|------|-------------|
| `-v, --version` | Show version with runtime info (Node, platform, config path) |
| `-h, --help` | Show help with examples and environment variables |

## Commands

### `memlink`

Show system overview: server URL, memories, entries count, total size.

```bash
memlink
```

### `memlink serve`

Start the MCP server. Supports Streamable HTTP and SSE transports.

```bash
memlink serve
memlink serve --port 4444
memlink serve --host localhost
memlink serve --port 8080 --host 0.0.0.0
memlink serve --cors "*"
memlink serve --read-only
memlink serve --daemon                         # Run in background
memlink serve --daemon --log-level verbose      # Daemon with verbose logging
```

Options:
- `--port <port>` — Port to listen on (default: 4444, env: `MEMLINK_PORT` or `PORT`)
- `--host <host>` — Host to bind to (default: localhost, env: `MEMLINK_HOST` or `HOST`)
- `--cors <origins>` — CORS allowed origins (comma-separated or `*`)
- `--read-only` — Disable write operations
- `--daemon` — Run server in background. Use `memlink stop` to stop
- `--log-level <level>` — Log level: `none`, `basic` (default in TTY), or `verbose`

### `memlink init <name>`

Create a new memory.

```bash
memlink init my-project
memlink init my-project --serve            # Create and auto-start server
memlink init my-project --serve --port 4444  # With custom port
```

Options:
- `--serve` — Auto-start the MCP server after creation
- `--port <port>` — Port for auto-start server

### `memlink create <name>`

Alias for `init`. Same options.

### `memlink delete <id>`

Permanently delete a memory and its data file.

```bash
memlink delete abc123def456
```

### `memlink ls`

List all memories with name, ID, and size.

```bash
memlink ls
```

### `memlink show <id>`

Show memory contents as consolidated Markdown.

```bash
memlink show abc123def456
```

### `memlink connect <id>`

Display MCP connection details and URL for a memory.

```bash
memlink connect abc123def456
```

### `memlink skill`

Install the Memlink agent skill for OpenCode.

```bash
memlink skill                  # Install in .agents/skills/memlink/ + tag in AGENTS.md
memlink skill --global         # Install in ~/.agents/skills/memlink/ + tag in ~/.agents/AGENTS.md
memlink skill -g               # Short flag for global
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

### `memlink bug`

Open GitHub to report a bug or send feedback.

```bash
memlink bug
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMLINK_DIR` | Data directory | `~/.memlink` |
| `MEMLINK_PORT` / `PORT` | Server port | `4444` |
| `MEMLINK_HOST` / `HOST` | Server host | `localhost` |
