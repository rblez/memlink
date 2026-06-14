#!/usr/bin/env bash
set -e

# ─── Memlink installer ────────────────────────────────────────────────────────
# Supports: Termux (Android), Linux, macOS
# Usage:    bash install.sh
# ─────────────────────────────────────────────────────────────────────────────

PACKAGE="@memlink/cli"
MIN_NODE=18

# ── Colors ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"
  RED="\033[31m"; CYAN="\033[36m"; RESET="\033[0m"
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; CYAN=""; RESET=""
fi

info()  { echo -e "${CYAN}▸${RESET} $*"; }
ok()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET}  $*"; }
error() { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }

# ── Detect environment ────────────────────────────────────────────────────────
IS_TERMUX=false
IS_MACOS=false
IS_LINUX=false

if [ -n "$TERMUX_VERSION" ] || [ -d "/data/data/com.termux" ]; then
  IS_TERMUX=true
elif [ "$(uname)" = "Darwin" ]; then
  IS_MACOS=true
else
  IS_LINUX=true
fi

echo ""
echo -e "${BOLD}  Memlink installer${RESET}"
if $IS_TERMUX; then
  echo -e "  Platform: ${CYAN}Termux (Android)${RESET}"
elif $IS_MACOS; then
  echo -e "  Platform: ${CYAN}macOS${RESET}"
else
  echo -e "  Platform: ${CYAN}Linux${RESET}"
fi
echo ""

# ── Install Node.js if missing ────────────────────────────────────────────────
install_node_termux() {
  info "Installing Node.js via pkg..."
  pkg update -y -q
  pkg install -y nodejs
  ok "Node.js installed"
}

install_node_macos() {
  if command -v brew &>/dev/null; then
    info "Installing Node.js via Homebrew..."
    brew install node
    ok "Node.js installed"
  else
    error "Node.js not found. Install it from https://nodejs.org or run: brew install node"
  fi
}

install_node_linux() {
  warn "Node.js not found."
  echo ""
  echo "  Install it with your package manager:"
  echo "    Debian/Ubuntu:  sudo apt install nodejs npm"
  echo "    Fedora:         sudo dnf install nodejs"
  echo "    Arch:           sudo pacman -S nodejs npm"
  echo "    Or via nvm:     https://github.com/nvm-sh/nvm"
  echo ""
  error "Please install Node.js $MIN_NODE+ and re-run this script."
}

if ! command -v node &>/dev/null; then
  if $IS_TERMUX; then
    install_node_termux
  elif $IS_MACOS; then
    install_node_macos
  else
    install_node_linux
  fi
fi

# ── Check Node version ────────────────────────────────────────────────────────
NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt "$MIN_NODE" ]; then
  error "Node.js $MIN_NODE+ required (found v$NODE_VERSION). Please upgrade."
fi
ok "Node.js v$(node --version | tr -d 'v') detected"

# ── Install npm if missing (Termux edge case) ─────────────────────────────────
if ! command -v npm &>/dev/null; then
  if $IS_TERMUX; then
    info "Installing npm..."
    pkg install -y nodejs-lts
    ok "npm installed"
  else
    error "npm not found. Please install Node.js with npm included."
  fi
fi

# ── Install @memlink/cli ──────────────────────────────────────────────────────
info "Installing ${PACKAGE}..."

if $IS_TERMUX; then
  # Termux: no sudo, prefix is handled by npm config
  npm install -g "$PACKAGE" --prefer-offline 2>/dev/null || \
  npm install -g "$PACKAGE"
else
  # Linux/macOS: try without sudo first (nvm/fnm/local node), then with sudo
  if npm install -g "$PACKAGE" 2>/dev/null; then
    : # success
  else
    info "Retrying with sudo..."
    sudo npm install -g "$PACKAGE"
  fi
fi

# ── Verify ────────────────────────────────────────────────────────────────────
if ! command -v memlink &>/dev/null; then
  echo ""
  warn "memlink installed but not found in PATH."
  if $IS_TERMUX; then
    echo ""
    echo "  Add this to your ~/.bashrc or ~/.zshrc:"
    echo "    export PATH=\"\$PATH:\$(npm root -g)/../bin\""
    echo ""
    echo "  Then reload: source ~/.bashrc"
  fi
  exit 1
fi

INSTALLED_VERSION=$(memlink --version 2>/dev/null | head -1 || echo "unknown")
echo ""
ok "memlink installed — ${INSTALLED_VERSION}"
echo ""
echo -e "  ${BOLD}Quick start:${RESET}"
echo -e "  ${CYAN}memlink serve --daemon${RESET}   # start MCP server"
echo -e "  ${CYAN}memlink url${RESET}              # get connection URL"
echo -e "  ${CYAN}memlink add \"Note\" \"...\"${RESET} # add an entry"
echo ""
