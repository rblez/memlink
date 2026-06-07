# Installation

## Via npm

```bash
npm install -g @memlink/cli
```

## Via pnpm

```bash
pnpm install -g @memlink/cli
```

## Via Yarn

```bash
yarn global add @memlink/cli
```

## Via Bun

```bash
bun install -g @memlink/cli
```

## From source

```bash
git clone https://github.com/rblez/memlink.git
cd memlink
bun install
npm run build
```

The binary is then available as `memlink` from the command line.

## Verify installation

```bash
memlink --version
```

## Standalone binary (no Node/Bun required)

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/rblez/memlink/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/rblez/memlink/main/install.ps1 | iex
```

The installer downloads the latest release binary to `~/.local/bin/memlink` (Linux/macOS)
or `%LOCALAPPDATA%\memlink\memlink.exe` (Windows) and adds it to your PATH.

## Running the daemon 24/7

| OS | Method | Command |
|----|--------|---------|
| Linux | systemd user service | `memlink install` |
| macOS | LaunchAgent | `memlink install` |
| Windows | supervisor (NSSM/pm2/Task Scheduler) | see below |

### Windows 24/7

Windows has no native user-daemon. Pick one:

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
1. Open `taskschd.msc`
2. Create Basic Task → "Memlink"
3. Trigger: "When the computer starts"
4. Action: Start a program → `memlink.exe` with arguments `serve --daemon`

**Persistent terminal** (simplest):
Run `memlink serve --daemon` in Windows Terminal / ConEmu / WSL.
