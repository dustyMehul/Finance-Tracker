#!/bin/bash
# install.sh — Finance Tracker setup for Mac/Linux
#
# Usage:
#   bash install.sh
#
# What it does:
#   1. Checks Python 3.12+, Node 18+, Ollama
#   2. Creates Python venv and installs backend dependencies
#   3. Builds the frontend
#   4. Pulls Ollama models (~5.5 GB — needs a good internet connection)
#   5. Seeds the database with default labels
#   6. Creates a start.sh launcher

set -e

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BOLD="\033[1m"
RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1"; exit 1; }
step() { echo -e "\n${BOLD}▶ $1${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Finance Tracker — Installer"
echo "  This will download ~5.5 GB of AI model data."
echo "  Make sure you have disk space and a stable connection."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Step 1: Check Python ──────────────────────────────────────────────────────
step "Checking Python 3.12+"

PYTHON=""
for cmd in python3.14 python3.13 python3.12 python3; do
  if command -v "$cmd" &>/dev/null; then
    VER=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    MAJOR=$(echo "$VER" | cut -d. -f1)
    MINOR=$(echo "$VER" | cut -d. -f2)
    if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 12 ]; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  fail "Python 3.12 or newer is required but not found.
         Install it from https://www.python.org/downloads/
         or via Homebrew:  brew install python@3.12"
fi
ok "Found $PYTHON ($VER)"

# ── Step 2: Check Node.js ─────────────────────────────────────────────────────
step "Checking Node.js 18+"

if ! command -v node &>/dev/null; then
  fail "Node.js is required but not found.
         Install it from https://nodejs.org/ (choose LTS)
         or via Homebrew:  brew install node"
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js 18 or newer is required. Found: $NODE_VER
         Update from https://nodejs.org/"
fi
ok "Found node $NODE_VER"

if ! command -v npm &>/dev/null; then
  fail "npm not found. It should come with Node.js — reinstall Node from https://nodejs.org/"
fi
ok "Found npm $(npm --version)"

# ── Step 3: Check Ollama ──────────────────────────────────────────────────────
step "Checking Ollama"

if ! command -v ollama &>/dev/null; then
  fail "Ollama is required but not found.
         Install it from https://ollama.com
         Then run this script again."
fi
ok "Found ollama $(ollama --version 2>/dev/null | head -1)"

# Check Ollama service is running
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  warn "Ollama service is not running. Starting it now..."
  ollama serve &>/dev/null &
  sleep 3
  if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    fail "Could not start Ollama service. Please start it manually:
           ollama serve
         Then run this script again."
  fi
fi
ok "Ollama service is running"

# ── Step 4: Python virtual environment ───────────────────────────────────────
step "Setting up Python virtual environment"

VENV="$ROOT/venv"
if [ ! -d "$VENV" ]; then
  $PYTHON -m venv "$VENV"
  ok "Created venv at $VENV"
else
  ok "venv already exists"
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
  ok "backend/.env already exists"
fi

# ── Step 7: Build frontend ───────────────────────────────────────────────────
step "Installing and building frontend"

cd "$ROOT/frontend"
npm install --silent
ok "Frontend dependencies installed"
npm run build
ok "Frontend built"
cd "$ROOT"

# ── Step 8: Pull Ollama models ───────────────────────────────────────────────
step "Pulling Ollama models (~5.5 GB)"
echo "  This may take 10–30 minutes depending on your internet speed."
echo ""

MODELS_NEEDED=()

if ! ollama list 2>/dev/null | grep -q "qwen2.5:7b"; then
  MODELS_NEEDED+=("qwen2.5:7b")
else
  ok "qwen2.5:7b already downloaded"
fi

if ! ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
  MODELS_NEEDED+=("nomic-embed-text")
else
  ok "nomic-embed-text already downloaded"
fi

for model in "${MODELS_NEEDED[@]}"; do
  echo "  Pulling $model..."
  ollama pull "$model"
  ok "$model downloaded"
done

# ── Step 9: Seed database ────────────────────────────────────────────────────
step "Seeding database with default labels"

cd "$ROOT"
python scripts/seed_labels.py
ok "Labels seeded"

# ── Step 10: Create start.sh launcher ───────────────────────────────────────
step "Creating start.sh launcher"

cat > "$ROOT/start.sh" << 'LAUNCHER'
#!/bin/bash
# start.sh — Launch Finance Tracker
# Run this every time you want to start the app.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT=8000

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Finance Tracker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Free port 8000 if in use
PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "  Freeing port $PORT..."
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Ensure Ollama is running
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "  Starting Ollama service..."
  ollama serve &>/dev/null &
  sleep 3
fi

# Activate venv
VENV="$ROOT/venv/bin/activate"
if [ ! -f "$VENV" ]; then
  echo "  ✗ venv not found. Did you run install.sh first?"
  exit 1
fi
source "$VENV"

# Open browser after a short delay (background)
(sleep 3 && open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true) &

echo "  Backend  → http://localhost:$PORT"
echo "  Frontend → http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$ROOT/frontend" && npm run dev &
VITE_PID=$!

cd "$ROOT/backend"
uvicorn app.main:app --port $PORT

kill $VITE_PID 2>/dev/null || true
LAUNCHER

chmod +x "$ROOT/start.sh"
ok "Created start.sh"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "  To start Finance Tracker, run:"
echo -e "    ${BOLD}bash start.sh${RESET}"
echo ""
echo "  Then open: http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
