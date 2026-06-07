# Installation

Requires [Node.js](https://nodejs.org) 18+ or [Bun](https://bun.sh) 1.0+.

## npm (recommended)

```bash
npm install -g @memlink/cli
```

Also works with `pnpm`, `yarn`, and `bun`.

## From source

```bash
git clone https://github.com/rblez/memlink.git
cd memlink
bun install
npm run build
```

The `memlink` command is then available via the `bin` field in `package.json`.

## Verify installation

```bash
memlink --version
```

## Running the server

Memlink runs as a per-session daemon:

```bash
memlink serve --daemon
```

The daemon dies when the session ends — this is by design. We don't try to compete with
systemd, launchd, or NSSM.

**Want it permanent?** Use the OS-native service manager of your choice:

- **Linux**: `systemd --user` unit, `pm2`, or `tmux`/`screen` in a long-lived session
- **macOS**: `launchd` user agent, `pm2`, or `tmux`/`screen`
- **Windows**: `pm2`, `NSSM`, or Task Scheduler

The daemon PID is at `~/.memlink/.serve.pid`. Health heartbeat at `~/.memlink/.health` (30s ticks).

## Uninstall

```bash
npm uninstall -g @memlink/cli
```
