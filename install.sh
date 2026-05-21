#!/bin/bash
set -e

# memlink Installer
# Downloads prebuilt binary from GitHub Releases
# Usage: curl -sL rblez.com/memlink/install.sh | bash

INSTALL_DIR="${HOME}/.local/bin"
FALLBACK_DIR="/usr/local/bin"
CONFIG_DIR="${HOME}/.memlink"
REPO="rblez/memlink"
GITHUB_API="https://api.github.com/repos/${REPO}/releases/latest"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[*]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[X]${NC} $1"; }

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux";;
        Darwin*) echo "darwin";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)       echo "unknown";;
    esac
}

# Detect architecture
detect_arch() {
    case "$(uname -m)" in
        x86_64)      echo "x64";;
        aarch64|arm64) echo "arm64";;
        *)           echo "x64";;
    esac
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get latest release tag from GitHub API
get_latest_tag() {
    log_info "Fetching latest release from GitHub..."

    local response
    response=$(curl -fsSL --max-time 15 "$GITHUB_API" 2>/dev/null) || {
        log_error "Failed to reach GitHub API. Check your internet connection."
        return 1
    }

    local tag
    tag=$(echo "$response" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')

    if [ -z "$tag" ] || [ "$tag" = "$response" ]; then
        log_error "Could not parse release tag from GitHub API response."
        return 1
    fi

    echo "$tag"
    return 0
}

# Download and install the binary
install_binary() {
    local os="$1"
    local arch="$2"
    local tag="$3"

    # Determine binary name
    local binary_name
    if [ "$os" = "windows" ]; then
        binary_name="memlink-windows-${arch}.exe"
    else
        binary_name="memlink-${os}-${arch}"
    fi

    local download_url="https://github.com/${REPO}/releases/download/${tag}/${binary_name}"

    log_info "OS: ${os} | Arch: ${arch}"
    log_info "Release: ${tag}"
    log_info "Binary: ${binary_name}"
    log_info "Downloading from: ${download_url}"

    # Create temp file
    local tmpfile
    tmpfile=$(mktemp "/tmp/memlink-${binary_name}.XXXXXX") || {
        log_error "Failed to create temporary file."
        return 1
    }

    # Download with curl
    if ! curl -fsSL --max-time 60 --retry 3 --retry-delay 2 -o "$tmpfile" "$download_url" 2>/dev/null; then
        rm -f "$tmpfile"
        log_error "Download failed. The binary '${binary_name}' may not exist for release '${tag}'."
        log_error "Check available releases at: https://github.com/${REPO}/releases"
        return 1
    fi

    # Determine install target
    local target_dir="$INSTALL_DIR"
    local target_path="${target_dir}/memlink"

    # Try primary install directory (~/.local/bin)
    mkdir -p "$target_dir" 2>/dev/null || true

    if [ -d "$target_dir" ] && [ -w "$target_dir" ]; then
        mv "$tmpfile" "$target_path"
        chmod +x "$target_path"
        log_info "Installed to: ${target_path}"
    else
        # Fallback to /usr/local/bin (requires sudo)
        log_warn "Cannot write to ${INSTALL_DIR}, trying ${FALLBACK_DIR} (requires sudo)..."
        target_dir="$FALLBACK_DIR"
        target_path="${target_dir}/memlink"

        if command_exists sudo; then
            sudo mv "$tmpfile" "$target_path"
            sudo chmod +x "$target_path"
            log_info "Installed to: ${target_path}"
        else
            rm -f "$tmpfile"
            log_error "Cannot write to ${INSTALL_DIR} or ${FALLBACK_DIR}."
            log_error "Ensure ~/.local/bin exists and is writable, or run with sudo."
            return 1
        fi
    fi

    return 0
}

# Ensure PATH includes install directory
check_path() {
    local target_dir="$1"

    case ":${PATH}:" in
        *:"${target_dir}":*)
            return 0
            ;;
        *)
            log_warn "${target_dir} is not in your PATH."
            echo ""
            echo "  Add it to your shell profile:"
            echo "    echo 'export PATH=\"${target_dir}:\$PATH\"' >> ~/.bashrc"
            echo "    source ~/.bashrc"
            echo ""
            echo "  Or run memlink directly: ${target_dir}/memlink"
            echo ""
            return 1
            ;;
    esac
}

# Main
main() {
    echo ""
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║         memlink Installer                 ║"
    echo "  ║     Universal Memory for AI Agents        ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo ""

    # Detect OS and architecture
    local os
    os=$(detect_os)
    local arch
    arch=$(detect_arch)

    # Windows warning
    if [ "$os" = "windows" ]; then
        log_warn "Windows detected."
        log_warn "Standalone binaries on Windows require manual installation."
        echo ""
        echo "  Download the latest release from:"
        echo "    https://github.com/${REPO}/releases/latest"
        echo ""
        echo "  Look for memlink-windows-${arch}.exe and place it in your PATH."
        echo ""
        exit 1
    fi

    if [ "$os" = "unknown" ]; then
        log_error "Unsupported OS: $(uname -s)"
        exit 1
    fi

    # Get latest release tag
    local tag
    tag=$(get_latest_tag) || exit 1

    log_info "Latest release: ${tag}"

    # Install the binary
    install_binary "$os" "$arch" "$tag" || exit 1

    # Determine where it was installed
    local installed_path
    if [ -f "${INSTALL_DIR}/memlink" ]; then
        installed_path="${INSTALL_DIR}/memlink"
    elif [ -f "${FALLBACK_DIR}/memlink" ]; then
        installed_path="${FALLBACK_DIR}/memlink"
    else
        log_error "Installation completed but binary not found."
        exit 1
    fi

    # Ensure config directory exists
    mkdir -p "$CONFIG_DIR"

    echo ""
    log_info "memlink installed successfully!"
    echo ""

    # Check PATH and run init if available
    if check_path "$(dirname "$installed_path")"; then
        log_info "Running memlink init..."
        echo ""
        memlink init
        echo ""
        log_info "Done! Start the MCP server with: memlink serve"
    else
        log_info "Initialize with: ${installed_path} init"
        log_info "Start the MCP server with: ${installed_path} serve"
    fi

    echo ""
    echo "  Docs: https://rblez.com/memlink"
    echo ""
}

main "$@"
