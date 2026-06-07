#!/usr/bin/env bash
# memlink installer (Linux / macOS)
# https://github.com/aiustantt/memlink
#
# curl -fsSL https://raw.githubusercontent.com/aiustantt/memlink/main/install.sh | bash
#
# Opt-out of anonymous install reports: MEMLINK_NO_REPORT=1

set -e

REPO="aiustantt/memlink"
BIN_NAME="memlink"
REPORT_URL="${MEMLINK_REPORT_URL:-https://api.memlink.cloud/v1/install/report}"
INSTALL_DIR="${MEMLINK_INSTALL_DIR:-$HOME/.local/bin}"

INSTALL_ID=""
VERSION=""
OS=""
ARCH=""
START_TIME=$(date +%s)

# ─── Helpers ────────────────────────────────────────────────────────────────

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
dim()   { printf "\033[2m%s\033[0m\n" "$*"; }

# ─── Install report (best-effort, never fails the install) ──────────────────

gen_install_id() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  elif [ -f /proc/sys/kernel/random/uuid ]; then
    cat /proc/sys/kernel/random/uuid
  else
    echo "$(date +%s)-$$-$RANDOM"
  fi
}

report() {
  local event="$1"  # start | success | failure
  local exit_code="${2:-0}"
  local line_no="${3:-0}"
  local message="${4:-}"

  if [ -n "${MEMLINK_NO_REPORT:-}" ]; then
    return 0
  fi

  local duration=$(( $(date +%s) - START_TIME ))
  local payload
  payload=$(cat <<EOF
{
  "install_id": "${INSTALL_ID}",
  "repo": "${REPO}",
  "os": "${OS}",
  "arch": "${ARCH}",
  "version": "${VERSION}",
  "event": "${event}",
  "exit_code": ${exit_code},
  "line": ${line_no},
  "message": "${message//\"/\\\"}",
  "duration_ms": $((duration * 1000)),
  "shell": "sh"
}
EOF
)

  # Best-effort, no fail
  curl -fsSL -X POST "$REPORT_URL" \
    -H "Content-Type: application/json" \
    -H "User-Agent: memlink-install/1.1.0" \
    --data-raw "$payload" \
    --connect-timeout 3 \
    --max-time 5 \
    >/dev/null 2>&1 || true
}

# Trap failures
on_error() {
  local exit_code=$?
  local line_no=${1:-0}
  if [ -n "${REPORTED_FAILURE:-}" ]; then
    return
  fi
  REPORTED_FAILURE=1
  report "failure" "$exit_code" "$line_no" "trap ERR" || true
}
trap 'on_error $LINENO' ERR

# ─── Detect OS / Arch ───────────────────────────────────────────────────────

detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    linux)  OS="linux" ;;
    darwin) OS="darwin" ;;
    *)
      red "Unsupported OS: $OS"
      red "Use the manual download: https://github.com/$REPO/releases"
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64)        ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
      red "Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac
}

# ─── Detect latest release ──────────────────────────────────────────────────

get_latest_version() {
  local api_url="https://api.github.com/repos/$REPO/releases/latest"
  local body
  body=$(curl -fsSL "$api_url" --max-time 10 2>/dev/null) || {
    red "Could not fetch latest release from GitHub."
    red "Check your internet connection or download manually:"
    red "  https://github.com/$REPO/releases"
    exit 1
  }

  VERSION=$(echo "$body" | grep '"tag_name"' | head -1 | sed -E 's/.*"v?([^"]+)".*/\1/')
  if [ -z "$VERSION" ]; then
    red "Could not parse latest version."
    exit 1
  fi
}

# ─── Install ────────────────────────────────────────────────────────────────

do_install() {
  cyan "Installing memlink v${VERSION} (${OS}/${ARCH})"
  cyan "  → ${INSTALL_DIR}/${BIN_NAME}"
  echo

  mkdir -p "$INSTALL_DIR"

  local asset="memlink-${OS}-${ARCH}.tar.gz"
  local url="https://github.com/$REPO/releases/download/v${VERSION}/${asset}"
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  dim "  Downloading $asset ..."
  curl -fsSL "$url" -o "$tmp/$asset" --max-time 60 || {
    red "Download failed. Check: $url"
    exit 1
  }

  dim "  Extracting ..."
  tar -xzf "$tmp/$asset" -C "$tmp"

  local extracted
  extracted=$(find "$tmp" -maxdepth 2 -name "$BIN_NAME" -type f | head -1)
  if [ -z "$extracted" ]; then
    red "Binary not found in archive."
    exit 1
  fi

  mv "$extracted" "$INSTALL_DIR/$BIN_NAME"
  chmod +x "$INSTALL_DIR/$BIN_NAME"

  # Verify
  if ! "$INSTALL_DIR/$BIN_NAME" --version >/dev/null 2>&1; then
    red "Installed binary failed self-test."
    exit 1
  fi

  echo
  green "✓ memlink v${VERSION} installed"
  echo

  # PATH warning
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
      dim "  Add to PATH (current shell):"
      dim "    export PATH=\"\$PATH:$INSTALL_DIR\""
      dim "  Or for bash:"
      dim "    echo 'export PATH=\"\$PATH:$INSTALL_DIR\"' >> ~/.bashrc"
      echo
      ;;
  esac

  dim "  Try it:"
  dim "    memlink --version"
  dim "    memlink serve --daemon"
  dim "    memlink install   # auto-start on login (Linux systemd / macOS launchd)"
  echo
}

# ─── Main ───────────────────────────────────────────────────────────────────

main() {
  detect_platform
  INSTALL_ID=$(gen_install_id)

  report "start" 0 0 "" || true

  get_latest_version
  do_install

  report "success" 0 0 "" || true
}

main "$@"
