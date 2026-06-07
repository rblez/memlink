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

## Run as a permanent daemon

### Linux (systemd)

```bash
memlink install    # Registers ~/.config/systemd/user/memlink.service
memlink status     # systemctl --user status memlink
memlink stop       # systemctl --user stop memlink
```

The service runs `memlink serve` (no `--daemon` flag needed — systemd handles backgrounding).

### macOS (LaunchAgent)

```bash
memlink install    # Registers ~/Library/LaunchAgents/memlink.plist
```

launchd keeps the server alive across reboots. Logs at `~/.memlink/memlink.log`.

### Windows

Windows has no native user-daemon. Pick an external supervisor:

**NSSM** (recommended, no admin):
```powershell
nssm.exe install Memlink "$env:LOCALAPPDATA\memlink\memlink.exe" "serve --daemon"
nssm.exe start Memlink
```

**pm2** (requires Node):
```bash
pm2 start memlink -- serve --daemon
pm2 save
pm2 startup
```

**Task Scheduler** (GUI):
1. `taskschd.msc` → Create Basic Task → "Memlink"
2. Trigger: "When the computer starts"
3. Action: Start `memlink.exe` with arguments `serve --daemon`

## Uninstall

| Method | Command |
|--------|---------|
| Standalone binary | `rm ~/.local/bin/memlink` (or `%LOCALAPPDATA%\memlink\memlink.exe`) |
| npm | `npm uninstall -g @memlink/cli` |
| System service | `memlink uninstall` |
| Windows supervisor | `nssm remove Memlink confirm` / `pm2 delete memlink` |
