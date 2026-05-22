#!/bin/bash
# memlink Installer — Linux/macOS
# Usage: curl -sL memlink.rblez.com/install.sh | sh
# Windows: iex (iwr memlink.rblez.com/install.sh).Content

set -e

REPO="rblez/memlink"
GITHUB_API="https://api.github.com/repos/${REPO}/releases/latest"

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

# Gradient: #00E5A0 → #FFFFFF → #CC00CC
C0='\033[38;2;0;229;160m'    C1='\033[38;2;20;231;167m'   C2='\033[38;2;39;233;175m'
C3='\033[38;2;59;235;182m'   C4='\033[38;2;78;237;190m'   C5='\033[38;2;98;239;197m'
C6='\033[38;2;118;241;204m'  C7='\033[38;2;137;243;212m'  C8='\033[38;2;157;245;219m'
C9='\033[38;2;176;247;227m'  CA='\033[38;2;196;249;234m'  CB='\033[38;2;216;251;242m'
CC='\033[38;2;235;253;249m'  CD='\033[38;2;255;255;255m'  CE='\033[38;2;251;234;251m'
CF='\033[38;2;246;213;246m'  CG='\033[38;2;242;191;242m'  CH='\033[38;2;238;170;238m'
CI='\033[38;2;234;149;234m'  CJ='\033[38;2;229;128;229m'  CK='\033[38;2;225;106;225m'
CL='\033[38;2;221;85;221m'   CM='\033[38;2;217;64;217m'   CN='\033[38;2;212;43;212m'
CO='\033[38;2;208;21;208m'   CP='\033[38;2;204;0;204m'
R='\033[0m'

# ─── Helpers ──────────────────────────────────────────────────────────────────

cline() {
    local s="$1"
    local colors=("$C0" "$C1" "$C2" "$C3" "$C4" "$C5" "$C6" "$C7" "$C8" "$C9" "$CA" "$CB" "$CC" "$CD" "$CE" "$CF" "$CG" "$CH" "$CI" "$CJ" "$CK" "$CL" "$CM" "$CN" "$CO" "$CP")
    local i=0 out=""
    while [ $i -lt ${#s} ]; do
        out="${out}${colors[$i]}${s:$i:1}"
        i=$((i + 1))
    done
    echo -e "${out}${R}"
}

print_banner() {
    echo ""
    cline '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⢠⣤⣤⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢠⣤⣤⣤⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⣿⣿⣿⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⠘⠛⠛⠛⣶⣶⣶⡞⠛⠛⠛⣶⣶⣶⡞⠛⠛⠛⠀⠀⠀⠀'
    cline '⣤⣤⣤⣤⣤⣤⣿⣿⡇⠀⠀⠀⣿⣿⣿⣤⣤⣤⣤⣤⣤'
    cline '⢸⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿'
    cline '⠘⠛⠛⠛⠛⠛⠛⠛⣿⣿⣿⡇⠀⠀⠀⣿⣿⡟⠛⠛⠛⠛⠛'
    cline '⠀⠀⠀⠀⢠⣤⣤⣤⣿⣿⣿⣧⣤⣤⣤⣿⣿⣿⣧⣤⣤⣤⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⣿⣿⣿⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⠛⠛⠛⠀⠀⠀⢸⣿⣿⠀⠀⠀⠘⠛⠛⠛⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀'
    echo ""
    echo -e "${DIM}  Universal Memory for AI Agents${R}"
    echo -e "${DIM}  Self-hosted · Fast · Organized${R}"
    echo ""
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

download_with_progress() {
    local url="$1" outfile="$2" bar_width=30
    local total
    total=$(curl -sIL --head "$url" 2>/dev/null | grep -i 'content-length' | tail -1 | tr -d '\r' | awk '{print $2}')

    if [ -z "$total" ] || [ "$total" -eq 0 ] 2>/dev/null; then
        curl -fsSL --max-time 60 --retry 3 -o "$outfile" "$url" 2>/dev/null
        return $?
    fi

    curl -fsSL --max-time 60 --retry 3 "$url" > "$outfile" 2>/dev/null &
    local pid=$!
    local gc=("$C0" "$C1" "$C2" "$C3" "$C4" "$C5" "$C6" "$C7" "$C8" "$C9" "$CA" "$CB" "$CC" "$CD" "$CE" "$CF" "$CG" "$CH" "$CI" "$CJ" "$CK" "$CL" "$CM" "$CN" "$CO" "$CP")

    while kill -0 $pid 2>/dev/null; do
        local downloaded
        downloaded=$(wc -c < "$outfile" 2>/dev/null | tr -d ' ' || echo 0)
        [ -z "$downloaded" ] && downloaded=0
        local pct=$((downloaded * 100 / total))
        [ "$pct" -gt 100 ] && pct=100

        local filled=$((pct * bar_width / 100))
        [ "$filled" -gt "$bar_width" ] && filled=$bar_width
        local empty=$((bar_width - filled))

        local bar="" i=0
        while [ $i -lt $filled ]; do bar="${bar}${gc[$((i % 26))]}▪${R}"; i=$((i + 1)); done
        i=0
        while [ $i -lt $empty ]; do bar="${bar}${gc[$(( (filled + i) % 26))]}▫${R}"; i=$((i + 1)); done

        printf "\r  ${bar} ${pct}%% ($((downloaded / 1024))/$((total / 1024)) KB)"
        sleep 0.15
    done

    wait $pid
    echo ""
    return $?
}

detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux";;
        Darwin*) echo "darwin";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)       echo "unknown";;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64)      echo "x64";;
        aarch64|arm64) echo "arm64";;
        *)           echo "x64";;
    esac
}

get_latest_tag() {
    local response
    response=$(curl -fsSL --max-time 15 "$GITHUB_API" 2>/dev/null) || return 1
    local tag
    tag=$(echo "$response" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
    [ -z "$tag" ] || [ "$tag" = "$response" ] && return 1
    echo "$tag"
}

# ─── Linux/macOS install ──────────────────────────────────────────────────────

install_unix() {
    local INSTALL_DIR="${HOME}/.local/bin"
    local FALLBACK_DIR="/usr/local/bin"
    local CONFIG_DIR="${HOME}/.memlink"

    print_banner

    local os arch runtime
    os=$(detect_os)
    arch=$(detect_arch)

    if command_exists bun; then runtime="bun"
    elif command_exists node; then runtime="node"
    else runtime="none"
    fi

    [ "$os" = "unknown" ] && { echo -e "${RED}Unsupported OS: $(uname -s)${R}"; exit 1; }

    if [ "$runtime" = "none" ]; then
        echo -e "${RED}bun or node is required but not installed.${R}"
        echo ""
        echo "  Install bun: curl -fsSL https://bun.sh/install | bash"
        echo ""
        exit 1
    fi

    local tag
    tag=$(get_latest_tag) || { echo -e "${RED}Failed to reach GitHub API.${R}"; exit 1; }

    local binary_name="memlink-${os}-${arch}"
    local download_url="https://github.com/${REPO}/releases/download/${tag}/${binary_name}"

    local tmpfile
    tmpfile=$(mktemp "/tmp/memlink-${binary_name}.XXXXXX") || exit 1

    download_with_progress "$download_url" "$tmpfile" || {
        rm -f "$tmpfile"
        echo -e "${RED}Download failed. Check: https://github.com/${REPO}/releases${R}"
        exit 1
    }

    local target_dir="$INSTALL_DIR" target_path="${INSTALL_DIR}/memlink"
    mkdir -p "$target_dir" 2>/dev/null || true

    if [ -d "$target_dir" ] && [ -w "$target_dir" ]; then
        mv "$tmpfile" "$target_path"
        chmod +x "$target_path"
    elif command_exists sudo; then
        sudo mv "$tmpfile" "${FALLBACK_DIR}/memlink"
        sudo chmod +x "${FALLBACK_DIR}/memlink"
        target_dir="$FALLBACK_DIR"
        target_path="${FALLBACK_DIR}/memlink"
    else
        rm -f "$tmpfile"
        echo -e "${RED}Cannot write to ${INSTALL_DIR} or ${FALLBACK_DIR}.${R}"
        exit 1
    fi

    mkdir -p "$CONFIG_DIR"

    local memlink_cmd="memlink"
    case ":${PATH}:" in
        *:"${target_dir}":*) ;;
        *) memlink_cmd="${target_path}" ;;
    esac

    echo ""
    echo -e "${GREEN}memlink ${tag} installed${R}"
    echo ""

    "$memlink_cmd" init

    echo ""
    echo -e "${DIM}  Start server: memlink serve${R}"
    echo -e "${DIM}  Docs: https://memlink.rblez.com/docs${R}"
    echo ""
}

# ─── Windows PowerShell install ──────────────────────────────────────────────
# When invoked via: iex (iwr memlink.rblez.com/install.sh).Content
# This section outputs PowerShell code that gets executed

install_windows() {
    cat << 'PWSH'
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  memlink — Universal Memory for AI Agents" -ForegroundColor DarkGray
Write-Host "  Self-hosted · Fast · Organized" -ForegroundColor DarkGray
Write-Host ""

$repo = "rblez/memlink"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"

try {
    $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -TimeoutSec 15
} catch {
    Write-Host "  Failed to reach GitHub API." -ForegroundColor Red
    exit 1
}

$tag = $release.tag_name
if (-not $tag) {
    Write-Host "  No release found." -ForegroundColor Red
    exit 1
}

$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
$asset = $release.assets | Where-Object { $_.name -like "*windows-${arch}*" } | Select-Object -First 1

if (-not $asset) {
    Write-Host "  No binary found for windows-${arch}." -ForegroundColor Red
    exit 1
}

$installDir = "$env:LOCALAPPDATA\memlink"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "  Downloading memlink-$tag ..." -ForegroundColor DarkGray
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "$installDir\memlink.exe" -UseBasicParsing

# Add to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$installDir;$userPath", "User")
    $env:Path = "$installDir;$env:Path"
}

Write-Host ""
Write-Host "  memlink $tag installed" -ForegroundColor Green
Write-Host ""

& "$installDir\memlink.exe" init

Write-Host ""
Write-Host "  Start server: memlink serve" -ForegroundColor DarkGray
Write-Host "  Docs: https://memlink.rblez.com/docs" -ForegroundColor DarkGray
Write-Host ""
PWSH
}

# ─── Entry point ──────────────────────────────────────────────────────────────

# Detect if running in PowerShell (via iex/iwr)
if [ -n "$PSModulePath" ] || [ -n "$PSVersionTable" ] || echo "$0" | grep -qi "powershell"; then
    install_windows
    exit 0
fi

# Detect Windows via uname (Git Bash, MSYS, Cygwin)
os=$(detect_os)
if [ "$os" = "windows" ]; then
    install_windows
    exit 0
fi

# Default: Linux/macOS
install_unix
