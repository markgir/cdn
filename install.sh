#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# CDN Manager — One-Command Installer
# Installs all required software and configures the environment.
#
# Usage:
#   chmod +x install.sh && ./install.sh
#
# Credits: Developed by iddigital.pt
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✖]${NC} $1"; }
section() { echo -e "\n${CYAN}── $1 ───${NC}"; }

# ── Root of the project ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   CDN Manager — One-Command Installer            ║${NC}"
echo -e "${CYAN}║   Developed by iddigital.pt                      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Node.js ─────────────────────────────────────────────────────────
section "Checking Node.js"

if ! command -v node &> /dev/null; then
  error "Node.js is not installed."
  echo "  Please install Node.js >= 18 from https://nodejs.org"
  echo "  Or use nvm:  nvm install 18 && nvm use 18"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Node.js >= 18 is required (found v${NODE_VERSION})."
  echo "  Please upgrade Node.js: https://nodejs.org"
  exit 1
fi

info "Node.js v${NODE_VERSION} detected"

# ── 2. Check npm ─────────────────────────────────────────────────────────────
section "Checking npm"

if ! command -v npm &> /dev/null; then
  error "npm is not installed. It usually comes with Node.js."
  exit 1
fi

NPM_VERSION=$(npm -v)
info "npm v${NPM_VERSION} detected"

# ── 3. Install server dependencies ───────────────────────────────────────────
section "Installing server dependencies"

cd "$SCRIPT_DIR/server"
npm install
info "Server dependencies installed"

# ── 4. Configure environment ─────────────────────────────────────────────────
section "Configuring environment"

cd "$SCRIPT_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example"
  warn "Review .env and update ADMIN_USER / ADMIN_PASS for production use."
else
  info ".env file already exists — skipping"
fi

# ── 5. Create data directory ─────────────────────────────────────────────────
section "Setting up data directory"

mkdir -p "$SCRIPT_DIR/data"
info "Data directory ready"

# ── 6. Verify installation ───────────────────────────────────────────────────
section "Verifying installation"

cd "$SCRIPT_DIR/server"
node -e "
  const deps = require('./package.json').dependencies;
  const missing = [];
  for (const pkg of Object.keys(deps)) {
    try { require(pkg); } catch { missing.push(pkg); }
  }
  if (missing.length) {
    console.error('Missing packages: ' + missing.join(', '));
    process.exit(1);
  }
  console.log('All ' + Object.keys(deps).length + ' dependencies verified.');
"
info "Installation verified successfully"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Installation complete!                         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Start the server:"
echo "    cd server && node index.js"
echo ""
echo "  Or use Docker:"
echo "    docker-compose up -d"
echo ""
echo "  Admin panel  → http://localhost:3001"
echo "  CDN proxy    → http://localhost:3000"
echo "  Debug panel  → http://localhost:3001/debug"
echo ""
echo -e "  ${CYAN}Developed by iddigital.pt${NC}"
echo ""
