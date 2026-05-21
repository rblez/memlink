#!/bin/bash
set -e

# memlink Demo Installer
# Builds from local source — no GitHub release needed
# Usage: ./install-demo.sh

INSTALL_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.memlink"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
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
    cline '⠀⠀⠀⠀⢠⣤⣤⣤⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢠⣤⣤⣤⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⠘⠛⠛⠛⣶⣶⣶⡞⠛⠛⠛⣶⣶⣶⡞⠛⠛⠛⠀⠀⠀⠀'
    cline '⢠⣤⣤⣤⣤⣤⣤⣤⣿⣿⣿⡇⠀⠀⠀⣿⣿⣿⣧⣤⣤⣤⣤⣤⣤⣤'
    cline '⢸⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿'
    cline '⠘⠛⠛⠛⠛⠛⠛⠛⣿⣿⣿⡇⠀⠀⠀⣿⣿⣿⡟⠛⠛⠛⠛⠛⠛⠛'
    cline '⠀⠀⠀⠀⢠⣤⣤⣤⣿⣿⣿⣧⣤⣤⣤⣿⣿⣿⣧⣤⣤⣤⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⠘⠛⠛⠛⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠘⠛⠛⠛⠀⠀⠀⠀'
    cline '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀'
    echo ""
    echo -e "${DIM}  Universal Memory for AI Agents${R}"
    echo -e "${DIM}  Self-hosted · Fast · Organized${R}"
    echo ""
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

detect_runtime() {
    if command_exists bun; then echo "bun"
    elif command_exists node; then echo "node"
    else echo "none"
    fi
}

detect_clipboard() {
    case "$(uname -s)" in
        Darwin*) echo "pbcopy" ;;
        CYGWIN*|MINGW*|MSYS*) echo "powershell" ;;
        Linux*)
            if command_exists termux-clipboard-set; then echo "termux"
            elif command_exists wl-copy; then echo "wl-copy"
            elif command_exists xclip; then echo "xclip"
            elif command_exists xsel; then echo "xsel"
            else echo "none"
            fi ;;
        *) echo "none" ;;
    esac
}

simulate_download() {
    local total_kb=2048 bar_width=30
    local gc=("$C0" "$C1" "$C2" "$C3" "$C4" "$C5" "$C6" "$C7" "$C8" "$C9" "$CA" "$CB" "$CC" "$CD" "$CE" "$CF" "$CG" "$CH" "$CI" "$CJ" "$CK" "$CL" "$CM" "$CN" "$CO" "$CP")
    local downloaded=0
    while [ "$downloaded" -lt "$((total_kb * 1024))" ]; do
        local chunk=$((RANDOM % 81920 + 20480))
        downloaded=$((downloaded + chunk))
        [ "$downloaded" -gt "$((total_kb * 1024))" ] && downloaded=$((total_kb * 1024))
        local pct=$((downloaded * 100 / (total_kb * 1024)))
        local filled=$((pct * bar_width / 100))
        [ "$filled" -gt "$bar_width" ] && filled=$bar_width
        local empty=$((bar_width - filled))
        local bar="" i=0
        while [ $i -lt $filled ]; do bar="${bar}${gc[$((i % 26))]}▪${R}"; i=$((i + 1)); done
        i=0
        while [ $i -lt $empty ]; do bar="${bar}${gc[$(( (filled + i) % 26))]}▫${R}"; i=$((i + 1)); done
        printf "\r  ${bar} ${pct}%% ($((downloaded / 1024))/${total_kb} KB)"
        sleep 0.08
    done
    echo ""
}

main() {
    print_banner

    local runtime clipboard
    runtime=$(detect_runtime)
    clipboard=$(detect_clipboard)

    if [ "$runtime" = "none" ]; then
        echo -e "${RED}bun or node is required but not installed.${R}"
        echo ""
        echo "  Install bun: curl -fsSL https://bun.sh/install | bash"
        echo ""
        exit 1
    fi

    if [ ! -f "${SCRIPT_DIR}/package.json" ]; then
        echo -e "${RED}package.json not found. Run from the memlink project root.${R}"
        exit 1
    fi

    simulate_download "memlink-linux-x64"

    # Install deps
    "$runtime" install --cwd "${SCRIPT_DIR}" >/dev/null 2>&1

    # Build standalone binary (no JS exposure)
    "$runtime" run build --cwd "${SCRIPT_DIR}" 2>/dev/null

    # Install standalone binary
    mkdir -p "$INSTALL_DIR"
    local target="${INSTALL_DIR}/memlink"
    local project_root="$(cd "${SCRIPT_DIR}" && pwd)"

    # Compile to native binary via bun build --compile
    local tmpbin
    tmpbin=$(mktemp /tmp/memlink-compile-XXXXXX)
    "$runtime" build "${project_root}/dist/cli/index.js" --compile --outfile "$tmpbin" 2>/dev/null
    mv "$tmpbin" "$target"
    chmod +x "$target"
    mkdir -p "$CONFIG_DIR"

    # Ensure PATH
    local memlink_cmd="memlink"
    case ":${PATH}:" in
        *:"${INSTALL_DIR}":*) ;;
        *) memlink_cmd="${target}" ;;
    esac

    echo ""
    echo -e "${GREEN}memlink demo installed${R}"
    echo ""

    # Run init
    "$memlink_cmd" init

    echo ""
    echo -e "${DIM}  Start server: memlink serve${R}"
    echo -e "${DIM}  Docs: https://rblez.com/memlink${R}"
    echo ""
}

main "$@"
