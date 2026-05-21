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
DIM='\033[2m'
NC='\033[0m'

# Gradient colors for banner (24-bit RGB)
# Left: #00E5A0 → Center: #FFFFFF → Right: #CC00CC
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

# Color a string by applying gradient per character position
# Usage: cline "char0char1...char25"
cline() {
    local s="$1"
    local colors=("$C0" "$C1" "$C2" "$C3" "$C4" "$C5" "$C6" "$C7" "$C8" "$C9" "$CA" "$CB" "$CC" "$CD" "$CE" "$CF" "$CG" "$CH" "$CI" "$CJ" "$CK" "$CL" "$CM" "$CN" "$CO" "$CP")
    local i=0
    local out=""
    while [ $i -lt ${#s} ]; do
        local ch="${s:$i:1}"
        out="${out}${colors[$i]}${ch}"
        i=$((i + 1))
    done
    echo -e "${out}${R}"
}

# Banner
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

log_info()  { echo -e "${GREEN}[*]${R} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${R} $1"; }
log_error() { echo -e "${RED}[X]${R} $1"; }

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
    print_banner

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
    echo -e "${DIM}  Docs: https://rblez.com/memlink${R}"
    echo ""
}

main "$@"
