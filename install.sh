#!/bin/bash
# install.sh — Finance Tracker setup for Mac/Linux
#
# Usage:
#   bash install.sh

set -e

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo -e "\n  ${RED}✗  $1${RESET}\n"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ask()  { echo -en "  ${BOLD}$1${RESET} "; }

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Finance Tracker — Installer (Mac/Linux)${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  This will set up everything needed to run Finance Tracker."
echo "  The AI models alone are ~5.5 GB — have a stable connection."
echo ""

# ── Port configuration ────────────────────────────────────────────────────────
step "Port configuration"

ask "Backend port (API server) [default: 8000]:"
read -r INPUT_BACKEND_PORT
BACKEND_PORT="${INPUT_BACKEND_PORT:-8000}"
ok "Backend port: $BACKEND_PORT"

ask "Frontend port (web UI)    [default: 5173]:"
read -r INPUT_FRONTEND_PORT
FRONTEND_PORT="${INPUT_FRONTEND_PORT:-5173}"
ok "Frontend port: $FRONTEND_PORT"

# ── Helper: ask yes/no ────────────────────────────────────────────────────────
confirm() {
  # confirm "Question?" → returns 0 for yes, 1 for no
  ask "$1 [Y/n]:"
  read -r ans
  [[ -z "$ans" || "$ans" =~ ^[Yy] ]]
}

# ── Helper: find a binary, return path or empty ───────────────────────────────
find_binary() {
  command -v "$1" 2>/dev/null || true
}

# ── Step 1: Python ────────────────────────────────────────────────────────────
step "Python 3.12+"

PYTHON=""

if confirm "Is Python 3.12 or newer already installed on this machine?"; then
  # Try to auto-detect
  DETECTED=""
  for cmd in python3.14 python3.13 python3.12 python3 python; do
    p=$(find_binary "$cmd")
    if [ -n "$p" ]; then
      ver=$("$p" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || true)
      maj=$(echo "$ver" | cut -d. -f1)
      min=$(echo "$ver" | cut -d. -f2)
      if [ "$maj" -eq 3 ] && [ "$min" -ge 12 ] 2>/dev/null; then
        DETECTED="$p"
        break
      fi
    fi
  done

  if [ -n "$DETECTED" ]; then
    warn "Auto-detected: $DETECTED ($ver)"
    if confirm "  Use this?"; then
      PYTHON="$DETECTED"
    fi
  fi

  if [ -z "$PYTHON" ]; then
    ask "  Enter full path to python binary (e.g. /usr/local/bin/python3.12):"
    read -r CUSTOM_PYTHON
    if [ ! -x "$CUSTOM_PYTHON" ]; then
      fail "Path not found or not executable: $CUSTOM_PYTHON"
    fi
    ver=$("$CUSTOM_PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null) || fail "Could not run $CUSTOM_PYTHON"
    maj=$(echo "$ver" | cut -d. -f1)
    min=$(echo "$ver" | cut -d. -f2)
    if ! ([ "$maj" -eq 3 ] && [ "$min" -ge 12 ]); then
      fail "Python 3.12+ required, but $CUSTOM_PYTHON is version $ver"
    fi
    PYTHON="$CUSTOM_PYTHON"
  fi
  ok "Using Python: $PYTHON ($ver)"

else
  echo ""
  echo "  Install Python 3.12+ using one of these methods:"
  echo ""
  echo "    Homebrew (recommended):"
  echo "      brew install python@3.12"
  echo ""
  echo "    Or download the installer from:"
  echo "      https://www.python.org/downloads/"
  echo ""
  if confirm "  Install via Homebrew now? (Homebrew must already be installed)"; then
    brew install python@3.12
    PYTHON=$(find_binary python3.12) || PYTHON=$(find_binary python3)
    if [ -z "$PYTHON" ]; then
      fail "Installation seemed to succeed but python3.12 not found in PATH. Open a new terminal and retry."
    fi
    ver=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    ok "Installed Python: $PYTHON ($ver)"
  else
    fail "Python 3.12+ is required. Install it and run this script again."
  fi
fi

# ── Step 2: Node.js ───────────────────────────────────────────────────────────
step "Node.js 18+"

NODE=""
NPM=""

if confirm "Is Node.js 18 or newer already installed?"; then
  DETECTED=$(find_binary node)

  if [ -n "$DETECTED" ]; then
    node_ver=$("$DETECTED" -e "process.stdout.write(process.versions.node)" 2>/dev/null || true)
    warn "Auto-detected: $DETECTED ($node_ver)"
    if confirm "  Use this?"; then
      NODE="$DETECTED"
    fi
  fi

  if [ -z "$NODE" ]; then
    ask "  Enter full path to node binary (e.g. /usr/local/bin/node):"
    read -r CUSTOM_NODE
    if [ ! -x "$CUSTOM_NODE" ]; then
      fail "Path not found or not executable: $CUSTOM_NODE"
    fi
    node_ver=$("$CUSTOM_NODE" -e "process.stdout.write(process.versions.node)" 2>/dev/null) || fail "Could not run $CUSTOM_NODE"
    NODE="$CUSTOM_NODE"
  fi

  node_major=$(echo "$node_ver" | cut -d. -f1)
  if [ "$node_major" -lt 18 ]; then
    fail "Node.js 18+ required, found $node_ver. Update from https://nodejs.org/"
  fi

  # Find npm alongside node
  NPM=$(dirname "$NODE")/npm
  [ ! -x "$NPM" ] && NPM=$(find_binary npm)
  [ -z "$NPM" ] && fail "npm not found alongside node. Reinstall Node from https://nodejs.org/"
  ok "Using node: $NODE ($node_ver), npm: $NPM"

else
  echo ""
  echo "  Install Node.js 18+ using one of these methods:"
  echo ""
  echo "    Homebrew (recommended):"
  echo "      brew install node"
  echo ""
  echo "    Or download the installer (LTS version) from:"
  echo "      https://nodejs.org/"
  echo ""
  if confirm "  Install via Homebrew now?"; then
    brew install node
    NODE=$(find_binary node) || fail "node not found after install. Open a new terminal and retry."
    NPM=$(find_binary npm)   || fail "npm not found after install."
    node_ver=$("$NODE" -e "process.stdout.write(process.versions.node)")
    ok "Installed Node: $NODE ($node_ver)"
  else
    fail "Node.js 18+ is required. Install it and run this script again."
  fi
fi

# ── Step 3: Ollama ────────────────────────────────────────────────────────────
step "Ollama (local AI)"

OLLAMA=""

if confirm "Is Ollama already installed?"; then
  DETECTED=$(find_binary ollama)

  if [ -n "$DETECTED" ]; then
    ollama_ver=$("$DETECTED" --version 2>/dev/null | head -1 || true)
    warn "Auto-detected: $DETECTED ($ollama_ver)"
    if confirm "  Use this?"; then
      OLLAMA="$DETECTED"
    fi
  fi

  if [ -z "$OLLAMA" ]; then
    ask "  Enter full path to ollama binary (e.g. /usr/local/bin/ollama):"
    read -r CUSTOM_OLLAMA
    if [ ! -x "$CUSTOM_OLLAMA" ]; then
      fail "Path not found or not executable: $CUSTOM_OLLAMA"
    fi
    OLLAMA="$CUSTOM_OLLAMA"
  fi
  ok "Using Ollama: $OLLAMA"

else
  echo ""
  echo "  Install Ollama from:"
  echo "    https://ollama.com"
  echo ""
  echo "  Or install via Homebrew:"
  echo "      brew install ollama"
  echo ""
  if confirm "  Install via Homebrew now?"; then
    brew install ollama
    OLLAMA=$(find_binary ollama) || fail "ollama not found after install. Open a new terminal and retry."
    ok "Installed Ollama: $OLLAMA"
  else
    fail "Ollama is required. Install it from https://ollama.com and run this script again."
  fi
fi

# Ensure Ollama service is running
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  warn "Ollama service not running — starting it now..."
  "$OLLAMA" serve &>/dev/null &
  sleep 3
  if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    fail "Could not start Ollama service. Run 'ollama serve' in another terminal, then retry."
  fi
fi
ok "Ollama service is running"

# ── Step 4: Python virtual environment ───────────────────────────────────────
step "Python virtual environment"

VENV="$ROOT/venv"
if [ -d "$VENV" ]; then
  warn "venv already exists at $VENV"
  if ! confirm "  Re-use it?"; then
    rm -rf "$VENV"
    "$PYTHON" -m venv "$VENV"
    ok "Re-created venv"
  else
    ok "Re-using existing venv"
  fi
else
  "$PYTHON" -m venv "$VENV"
  ok "Created venv at $VENV"
fi

source "$VENV/bin/activate"
ok "Activated venv ($(python --version))"

# ── Step 5: Install backend dependencies ─────────────────────────────────────
step "Installing backend dependencies"

pip install --quiet --upgrade pip
pip install --quiet -r "$ROOT/backend/requirements.txt"
ok "Backend dependencies installed"

# ── Step 6: Copy .env if missing ─────────────────────────────────────────────
step "Configuring environment"

if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  ok "Created backend/.env from .env.example"
else
  ok "backend/.env already exists — leaving it unchanged"
fi

# ── Step 7: Build frontend ───────────────────────────────────────────────────
step "Building frontend"

cd "$ROOT/frontend"
"$NPM" install --silent
ok "Frontend dependencies installed"
"$NPM" run build
ok "Frontend built"
cd "$ROOT"

# ── Step 8: Pull Ollama models ───────────────────────────────────────────────
step "Pulling AI models (~5.5 GB total)"
echo "  This may take 10–30 minutes on a typical connection."
echo ""

pull_model() {
  local model="$1"
  if "$OLLAMA" list 2>/dev/null | grep -q "^${model}"; then
    ok "$model already downloaded"
  else
    echo "  Downloading $model..."
    "$OLLAMA" pull "$model"
    ok "$model downloaded"
  fi
}

pull_model "qwen2.5:7b"
pull_model "nomic-embed-text"

# ── Step 9: Seed database ────────────────────────────────────────────────────
step "Seeding database"

cd "$ROOT"
python scripts/seed_labels.py
ok "Default labels seeded"

# ── Step 10: Generate start.sh ───────────────────────────────────────────────
step "Generating start.sh launcher"

cat > "$ROOT/start.sh" << LAUNCHER
#!/bin/bash
# start.sh — Launch Finance Tracker
# Run this every time you want to start the app.

set -e

ROOT="\$(cd "\$(dirname "\$0")" && pwd)"
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
OLLAMA_BIN="$OLLAMA"
NODE_BIN="$NODE"
NPM_BIN="$NPM"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Finance Tracker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Free backend port if in use
PIDS=\$(lsof -ti :\$BACKEND_PORT 2>/dev/null || true)
if [ -n "\$PIDS" ]; then
  echo "  Freeing port \$BACKEND_PORT..."
  echo "\$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Ensure Ollama is running
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "  Starting Ollama..."
  "\$OLLAMA_BIN" serve &>/dev/null &
  sleep 3
fi

# Activate venv
source "\$ROOT/venv/bin/activate"

# Open browser after short delay
(sleep 3 && open "http://localhost:\$FRONTEND_PORT" 2>/dev/null || xdg-open "http://localhost:\$FRONTEND_PORT" 2>/dev/null || true) &

echo "  Backend  → http://localhost:\$BACKEND_PORT"
echo "  Frontend → http://localhost:\$FRONTEND_PORT"
echo ""
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start frontend in background
cd "\$ROOT/frontend"
VITE_PORT=\$FRONTEND_PORT "\$NPM_BIN" run dev &
VITE_PID=\$!

# Start backend (foreground — Ctrl+C stops everything)
cd "\$ROOT/backend"
uvicorn app.main:app --port \$BACKEND_PORT

kill \$VITE_PID 2>/dev/null || true
LAUNCHER

chmod +x "$ROOT/start.sh"
ok "Generated start.sh (ports: backend=$BACKEND_PORT, frontend=$FRONTEND_PORT)"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "  To launch Finance Tracker:"
echo -e "    ${BOLD}bash start.sh${RESET}"
echo ""
echo "  Then open: http://localhost:$FRONTEND_PORT"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
