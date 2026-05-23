# CLI Reference

## Global flags

| Flag | Description |
|------|-------------|
| `--version` | Show version |
| `-h, --help` | Show help |
| `--json` | Scriptable JSON output (all commands) |

## Commands

### `memlink`

Show system overview: server URL, memories, entries count, total size.

```bash
memlink
```

### `memlink serve`

Start the MCP server.

```bash
memlink serve
memlink serve --port 4444
memlink serve --host localhost
memlink serve --port 8080 --host 0.0.0.0
```

Options:
- `--port <port>` — Port to listen on (default: 4444, env: `MEMLINK_PORT` or `PORT`)
- `--host <host>` — Host to bind to (default: localhost, env: `MEMLINK_HOST` or `HOST`)

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

Display MCP connection details and JSON config for a memory.

```bash
memlink connect abc123def456
```

### `memlink skill`

Install the Memlink agent skill for OpenCode.

```bash
memlink skill                  # Install in .agents/skills/memlink/ (workspace)
memlink skill --global         # Install in ~/.agents/skills/memlink/ (global)
memlink skill -g               # Short flag for global
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
