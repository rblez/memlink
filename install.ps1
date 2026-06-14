# ─── Memlink installer for Windows (PowerShell) ──────────────────────────────
# Usage: irm https://raw.githubusercontent.com/rblez/memlink/main/install.ps1 | iex
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$PACKAGE  = "@memlink/cli"
$MIN_NODE = 18

function Write-Info  { param($msg) Write-Host "  [>] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  [+] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  [x] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  Memlink installer" -ForegroundColor White
Write-Host "  Platform: Windows (PowerShell)" -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ─────────────────────────────────────────────────────────────
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    Write-Warn "Node.js not found."
    Write-Host ""

    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    $hasChoco  = Get-Command choco  -ErrorAction SilentlyContinue
    $hasScoop  = Get-Command scoop  -ErrorAction SilentlyContinue

    if ($hasWinget) {
        Write-Info "Installing Node.js via winget..."
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Ok "Node.js installed"
    } elseif ($hasChoco) {
        Write-Info "Installing Node.js via Chocolatey..."
        choco install nodejs-lts -y
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Ok "Node.js installed"
    } elseif ($hasScoop) {
        Write-Info "Installing Node.js via Scoop..."
        scoop install nodejs-lts
        Write-Ok "Node.js installed"
    } else {
        Write-Host ""
        Write-Host "  Node.js $MIN_NODE+ is required. Install it from:" -ForegroundColor Yellow
        Write-Host "    https://nodejs.org/en/download" -ForegroundColor White
        Write-Host ""
        Write-Host "  Or via winget:       winget install OpenJS.NodeJS.LTS"
        Write-Host "  Or via Chocolatey:   choco install nodejs-lts"
        Write-Host "  Or via Scoop:        scoop install nodejs-lts"
        Write-Host ""
        Write-Fail "Please install Node.js $MIN_NODE+ and re-run this script."
    }
}

# ── Check Node version ────────────────────────────────────────────────────────
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "Node.js still not found after install. Please restart your terminal and try again."
}

$nodeVersion = node -e "process.stdout.write(process.versions.node.split('.')[0])"
if ([int]$nodeVersion -lt $MIN_NODE) {
    Write-Fail "Node.js $MIN_NODE+ required (found v$nodeVersion). Please upgrade from https://nodejs.org"
}

$nodeFullVersion = node --version
Write-Ok "Node.js $nodeFullVersion detected"

# ── Check npm ─────────────────────────────────────────────────────────────────
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Fail "npm not found. Re-install Node.js from https://nodejs.org (npm is included)."
}

# ── Install @memlink/cli ──────────────────────────────────────────────────────
Write-Info "Installing $PACKAGE..."

try {
    npm install -g $PACKAGE
} catch {
    Write-Fail "npm install failed: $_"
}

# ── Verify ────────────────────────────────────────────────────────────────────
$memlinkCmd = Get-Command memlink -ErrorAction SilentlyContinue
if (-not $memlinkCmd) {
    Write-Host ""
    Write-Warn "memlink installed but not found in PATH."
    Write-Host ""
    Write-Host "  Try restarting your terminal, or add npm's global bin to PATH:"
    Write-Host "    npm config get prefix"
    Write-Host "  Then add that path + \bin to your system PATH."
    Write-Host ""
    exit 1
}

$installedVersion = (memlink --version 2>$null | Select-Object -First 1)
Write-Host ""
Write-Ok "memlink installed — $installedVersion"
Write-Host ""
Write-Host "  Quick start:" -ForegroundColor White
Write-Host "    memlink serve --daemon   " -NoNewline; Write-Host "# start MCP server" -ForegroundColor DarkGray
Write-Host "    memlink url              " -NoNewline; Write-Host "# get connection URL" -ForegroundColor DarkGray
Write-Host "    memlink add ""Note"" ""..."" " -NoNewline; Write-Host "# add an entry" -ForegroundColor DarkGray
Write-Host ""
