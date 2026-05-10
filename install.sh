#!/bin/bash
set -e

# Memlink Installation Script
# Interactive installer with progress bar and configuration

REPO="rblez/memlink"
VERSION="${1:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Icons
ICON_OK="☑"
ICON_WARN="⚠"
ICON_ERR="🛈"
ICON_EMPTY="□"
ICON_FULL="■"

# Print functions
print_header() {
  echo -e "${WHITE}========================================${NC}"
  echo -e "${WHITE}  Memlink Installation${NC}"
  echo -e "${WHITE}========================================${NC}"
  echo ""
}

print_ok() {
  echo -e "${GREEN}${ICON_OK} $1${NC}"
}

print_warn() {
  echo -e "${YELLOW}${ICON_WARN} $1${NC}"
}

print_err() {
  echo -e "${RED}[ERROR] $1${NC}"
}

print_info() {
  echo -e "${WHITE}$1${NC}"
}

# Progress bar with squares
show_progress() {
  local current=$1
  local total=$2
  local prefix="${3:-Descargando}"
  
  local percent=$((current * 100 / total))
  local width=50
  local filled=$((percent * width / 100))
  local empty=$((width - filled))
  
  # Build bar string
  local bar=""
  for ((i=0; i<filled; i++)); do
    bar="${bar}${GREEN}${ICON_FULL}${NC}"
  done
  for ((i=0; i<empty; i++)); do
    bar="${bar}${WHITE}${ICON_EMPTY}${NC}"
  done
  
  printf "\r  ${prefix} [${bar}] %3d%%" $percent
  
  if [ $percent -eq 100 ]; then
    echo ""
  fi
}

# Check for curl
check_curl() {
  if ! command -v curl &> /dev/null; then
    print_err "curl no encontrado. Por favor instalalo primero."
    exit 1
  fi
}

# Check if already installed
check_installed() {
  if command -v memlink &> /dev/null; then
    print_warn "Memlink ya está instalado en: $(which memlink)"
    read -p "  ¿Sobrescribir? (s/N): " overwrite
    if [ "${overwrite^}" != "S" ]; then
      print_info "Instalación cancelada."
      exit 0
    fi
  fi
}

# Detect OS and architecture
detect_system() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  
  print_info "Sistema detectado: ${OS}/${ARCH}"
  
  case $ARCH in
    x86_64|amd64)
      ARCH_SUFFIX="x64"
      ;;
    aarch64|arm64)
      ARCH_SUFFIX="arm64"
      ;;
    *)
      print_err "Arquitectura no soportada: ${ARCH}"
      print_info "Soportado: x86_64, aarch64, arm64"
      exit 1
      ;;
  esac
  
  case $OS in
    linux)
      OS_TARGET="linux"
      ;;
    darwin)
      OS_TARGET="darwin"
      ;;
    msys*|mingw*|cygwin|windows)
      OS_TARGET="windows"
      print_warn "Windows detectado. Descarga el binario manualmente desde:"
      print_info "  https://github.com/${REPO}/releases"
      exit 0
      ;;
    *)
      print_err "Sistema no soportado: ${OS}"
      print_info "Soportado: Linux, macOS"
      exit 1
      ;;
  esac
}

# Get download URL
get_download_url() {
  if [ "$VERSION" = "latest" ]; then
    DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"
  else
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}"
  fi
}

# Download with progress
download_binary() {
  BINARY_NAME="memlink-${OS_TARGET}-${ARCH_SUFFIX}"
  if [ "$OS_TARGET" = "windows" ]; then
    BINARY_NAME="${BINARY_NAME}.exe"
  fi
  
  get_download_url
  
  TEMP_DIR=$(mktemp -d)
  TEMP_FILE="${TEMP_DIR}/${BINARY_NAME}"
  
  print_info "URL: ${DOWNLOAD_URL}"
  echo ""
  
  # Check file size first
  CONTENT_LENGTH=$(curl -sI "$DOWNLOAD_URL" 2>/dev/null | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
  
  if [ -n "$CONTENT_LENGTH" ]; then
    BYTES_TOTAL=$CONTENT_LENGTH
    BYTES_DOWNLOADED=0
    
    # Download with progress
    curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL" 2>/dev/null &
    CURL_PID=$!
    
    while kill -0 $CURL_PID 2>/dev/null; do
      if [ -f "$TEMP_FILE" ]; then
        BYTES_DOWNLOADED=$(stat -f%z "$TEMP_FILE" 2>/dev/null || stat -c%s "$TEMP_FILE" 2>/dev/null || echo 0)
        show_progress $BYTES_DOWNLOADED $BYTES_TOTAL "Descargando"
      fi
      sleep 0.1
    done
    
    wait $CURL_PID
  else
    # Fallback: simple download
    print_info "Descargando..."
    curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
  fi
  
  if [ ! -s "$TEMP_FILE" ]; then
    print_err "Descarga falló o archivo vacío"
    rm -rf "$TEMP_DIR"
    exit 1
  fi
  
  print_ok "Descarga completada"
}

# Interactive configuration
ask_config() {
  echo ""
  print_info "=== Configuración ==="
  echo ""
  
  # Server port
  read -p "  Puerto del servidor MCP [4444]: " INPUT_PORT
  SERVER_PORT=${INPUT_PORT:-4444}
  
  # Install directory
  read -p "  Directorio de instalación [/usr/local/bin]: " INPUT_DIR
  INSTALL_DIR=${INPUT_DIR:-/usr/local/bin}
  
  # Auto start
  read -p "  ¿Iniciar servidor automáticamente? (s/N): " INPUT_AUTO
  AUTO_START=${INPUT_AUTO:-n}
  
  # Create memory
  read -p "  ¿Crear memoria inicial? (s/N): " INPUT_MEMORY
  CREATE_MEMORY=${INPUT_MEMORY:-n}
  
  echo ""
}

# Install binary
install_binary() {
  print_info "Instalando en ${INSTALL_DIR}..."
  
  if [ ! -w "$INSTALL_DIR" ]; then
    print_info "Necesitas permisos de administrador..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo mv "$TEMP_DIR/$BINARY_NAME" "$INSTALL_DIR/memlink"
  else
    mv "$TEMP_DIR/$BINARY_NAME" "$INSTALL_DIR/memlink"
  fi
  
  chmod +x "$INSTALL_DIR/memlink"
  
  # Cleanup temp
  rm -rf "$TEMP_DIR"
  
  # Add to PATH if needed
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    print_warn "${INSTALL_DIR} no está en tu PATH"
    print_info "Agrega esta línea a tu ~/.bashrc o ~/.zshrc:"
    echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
  fi
  
  print_ok "Instalación completada"
}

# Run memlink init
run_init() {
  # Save config
  CONFIG_DIR="$HOME/.memlink"
  mkdir -p "$CONFIG_DIR"
  
  cat > "$CONFIG_DIR/config.json" << EOF
{
  "serverPort": ${SERVER_PORT},
  "serverHost": "localhost",
  "agents": [],
  "universalMemories": []
}
EOF
  
  if [ "${AUTO_START^}" = "S" ]; then
    print_info "Iniciando servidor MCP en puerto ${SERVER_PORT}..."
    $INSTALL_DIR/memlink serve -p $SERVER_PORT &
    sleep 2
    print_ok "Servidor iniciado"
  fi
  
  if [ "${CREATE_MEMORY^}" = "S" ]; then
    print_info "Creando memoria inicial..."
    $INSTALL_DIR/memlink memory create "Mi Memoria"
  fi
}

# Main
main() {
  print_header
  
  check_curl
  check_installed
  detect_system
  download_binary
  ask_config
  install_binary
  run_init
  
  echo ""
  print_ok "¡Memlink instalado correctamente!"
  echo ""
  print_info "Ejecuta 'memlink --help' para ver los comandos disponibles"
  echo ""
}

main "$@"