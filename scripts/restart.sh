#!/bin/bash

# restart.sh
# Full reset and restart script for Finance Tracker backend.
#
# Usage (from project root):
#   bash scripts/restart.sh           # reset DB + restart uvicorn
#   bash scripts/restart.sh --no-reset  # just restart uvicorn (keep data)
#
# What it does:
#   1. Kills any process on port 8000
#   2. Verifies port is free
#   3. Resets DB + ChromaDB (unless --no-reset)
#   4. Seeds labels
#   5. Starts uvicorn

set -e

PORT=8000
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/backend"
RESET=true

# parse args
for arg in "$@"; do
  if [ "$arg" = "--no-reset" ]; then
    RESET=false
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Finance Tracker — restart script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: kill anything on port 8000 ──────────────────────────────────────
echo "▶ Checking port $PORT..."

kill_port() {
  # works on macOS and Linux
  local pids
  pids=$(lsof -ti :$PORT 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Found process(es) on port $PORT: $pids"
    echo "  Killing..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

kill_port

# ── Step 2: verify port is free ─────────────────────────────────────────────
echo "▶ Verifying port $PORT is free..."
sleep 1

STILL_IN_USE=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$STILL_IN_USE" ]; then
  echo "  ✗ Port $PORT still in use by PID $STILL_IN_USE. Trying again..."
  echo "$STILL_IN_USE" | xargs kill -9 2>/dev/null || true
  sleep 2
  FINAL_CHECK=$(lsof -ti :$PORT 2>/dev/null || true)
  if [ -n "$FINAL_CHECK" ]; then
    echo "  ✗ Could not free port $PORT. Aborting."
    exit 1
  fi
fi

echo "  ✓ Port $PORT is free"

# ── Step 3: activate venv ───────────────────────────────────────────────────
echo ""
echo "▶ Activating virtual environment..."
VENV="$BACKEND_DIR/../venv/bin/activate"
if [ ! -f "$VENV" ]; then
  VENV="$BACKEND_DIR/venv/bin/activate"
fi
if [ ! -f "$VENV" ]; then
  echo "  ✗ venv not found. Expected at $VENV"
  exit 1
fi
source "$VENV"
echo "  ✓ venv active: $(python --version)"

# ── Step 4: reset DB ────────────────────────────────────────────────────────
if [ "$RESET" = true ]; then
  echo ""
  echo "▶ Resetting database and vector store..."
  cd "$(dirname "$0")/.."
  python scripts/reset_db.py --confirm
  echo "  ✓ DB reset"

  echo ""
  echo "▶ Seeding labels..."
  python scripts/seed_labels.py
  echo "  ✓ Labels seeded"
else
  echo ""
  echo "▶ Skipping DB reset (--no-reset)"
fi

# ── Step 5: start uvicorn ───────────────────────────────────────────────────
echo ""
echo "▶ Starting uvicorn on port $PORT..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  http://localhost:$PORT"
echo "  http://localhost:$PORT/docs"
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$BACKEND_DIR"
uvicorn app.main:app --reload --port $PORT