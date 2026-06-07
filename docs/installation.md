# Installation

## Standalone binary (recommended)

No Node, Bun, or any runtime required. Self-contained executable with the Bun runtime embedded.

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/rblez/memlink/main/install.sh | bash
```

The installer:
1. Detects OS and architecture
2. Downloads the latest release from GitHub
3. Installs to `~/.local/bin/memlink`
4. Adds `~/.local/bin` to your PATH (if not already)
5. Sends an anonymous install report (opt-out with `MEMLINK_NO_REPORT=1`)

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/rblez/memlink/main/install.ps1 | iex
```

The installer:
1. Detects architecture (x64)
2. Downloads the latest release from GitHub
3. Installs to `%LOCALAPPDATA%\memlink\memlink.exe`
4. Adds it to your user PATH

### Supported platforms

| OS | Architectures |
|----|---------------|
| Linux | amd64, arm64 |
| macOS | amd64 (Intel), arm64 (Apple Silicon) |
| Windows | amd64 |

## npm

```bash
npm install -g @memlink/cli
```

Also works with `pnpm`, `yarn`, and `bun`.

Requires Node.js 18+ (or Bun).

## From source

```bash
git clone https://github.com/rblez/memlink.git
cd memlink
bun install
npm run build
```

The binary is then available as `memlink` (via the `bin` field in `package.json`).

## Docker (coming soon)

```bash
docker run -d -p 4444:4444 -v ~/.memlink:/root/.memlink rblez/memlink
```

## Verify installation

```bash
memlink --version
```

## Running the server

Memlink runs as a per-session daemon:

```bash
memlink serve --daemon
```

`--daemon` detaches the process from the terminal (Unix: `detached: true` + `unref()`. Windows: VBScript `WshShell.Run 0, False`). The daemon dies when the session ends. This is by design — we don't try to compete with systemd, launchd, or NSSM.

**Want it permanent?** Use the OS-native service manager of your choice:

- **Linux**: `systemd --user` unit, `pm2`, or `tmux`/`screen` in a long-lived session
- **macOS**: `launchd` user agent, `pm2`, or `tmux`/`screen`
- **Windows**: `pm2`, `NSSM`, or Task Scheduler

The daemon PID is at `~/.memlink/.serve.pid`. Health heartbeat at `~/.memlink/.health` (30s ticks).

## Uninstall

| Method | Command |
|--------|---------|
| Standalone binary | `rm ~/.local/bin/memlink` (or `%LOCALAPPDATA%\memlink\memlink.exe`) |
| npm | `npm uninstall -g @memlink/cli` |
