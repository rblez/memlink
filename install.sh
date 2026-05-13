#!/bin/bash
set -e

# Memlink Installer
# Usage: curl -sL rblez.com/memlink/install.sh | bash

MEMLINK_VERSION="2.0.0"
INSTALL_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.memlink"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[*]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[X]${NC} $1"; }

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "linux";;
        Darwin*)    echo "macos";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)          echo "unknown";;
    esac
}

# Detect architecture
detect_arch() {
    case "$(uname -m)" in
        x86_64)    echo "x64";;
        aarch64|arm64) echo "arm64";;
        *)         echo "x64";;
    esac
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Bun if needed
install_bun() {
    if command_exists bun; then
        log_info "Bun already installed: $(bun --version)"
        return 0
    fi

    log_info "Installing Bun..."

    local os=$(detect_os)
    local arch=$(detect_arch)

    if [ "$os" = "windows" ]; then
        log_warn "Windows detected. Using npm instead."
        return 1
    fi

    # Install Bun via official installer
    curl -fsSL https://bun.sh/install | bash

    # Source bun in current shell
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if command_exists bun; then
        log_info "Bun installed: $(bun --version)"
        return 0
    else
        log_error "Failed to install Bun"
        return 1
    fi
}

# Ensure install directory exists
ensure_dir() {
    if [ ! -d "$INSTALL_DIR" ]; then
        mkdir -p "$INSTALL_DIR"
    fi
}

# Create config directory
ensure_config() {
    if [ ! -d "$CONFIG_DIR" ]; then
        mkdir -p "$CONFIG_DIR"
    fi
}

# Install Memlink via Bun
install_via_bun() {
    if command_exists bun; then
        log_info "Installing Memlink via Bun..."
        bun add -g memlink
        return 0
    fi
    return 1
}

# Install Memlink via npm
install_via_npm() {
    if command_exists npm; then
        log_info "Installing Memlink via npm..."
        npm install -g memlink
        return 0
    fi
    return 1
}

# Install Memlink via pnpm
install_via_pnpm() {
    if command_exists pnpm; then
        log_info "Installing Memlink via pnpm..."
        pnpm add -g memlink
        return 0
    fi
    return 1
}

# Main
main() {
    echo ""
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║     Memlink Installer v${MEMLINK_VERSION}                 ║"
    echo "  ║     Universal Memory for AI Agents       ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo ""

    local installed=false

    # Try Bun first
    if install_bun; then
        if install_via_bun; then
            installed=true
        fi
    fi

    # Fallback to npm
    if [ "$installed" = false ]; then
        if install_via_npm; then
            installed=true
        fi
    fi

    # Fallback to pnpm
    if [ "$installed" = false ]; then
        if install_via_pnpm; then
            installed=true
        fi
    fi

    if [ "$installed" = true ]; then
        ensure_config

        echo ""
        log_info "Memlink installed successfully!"
        echo ""
        echo "  Next steps:"
        echo "    1. Run: memlink init"
        echo "    2. Run: memlink serve"
        echo "    3. Create a memory: memlink memory create MyProject"
        echo ""
        echo "  Docs: https://rblez.com/memlink"
        echo ""
    else
        log_error "Failed to install Memlink"
        echo ""
        echo "  Please install Bun, npm, or pnpm manually:"
        echo "    - Bun: curl -fsSL https://bun.sh/install | bash"
        echo "    - npm: npm install -g memlink"
        echo "    - pnpm: pnpm add -g memlink"
        echo ""
        exit 1
    fi
}

main "$@"