# install.ps1 — Finance Tracker setup for Windows (PowerShell)
#
# Usage (in PowerShell as Administrator):
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   .\install.ps1
#
# What it does:
#   1. Checks Python 3.12+, Node 18+, Ollama
#   2. Creates Python venv and installs backend dependencies
#   3. Builds the frontend
#   4. Pulls Ollama models (~5.5 GB — needs a good internet connection)
#   5. Seeds the database with default labels
#   6. Creates a start.bat launcher

$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [XX] $msg" -ForegroundColor Red; exit 1 }
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Finance Tracker — Installer (Windows)"
Write-Host "  This will download ~5.5 GB of AI model data."
Write-Host "  Make sure you have disk space and a stable connection."
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Python ──────────────────────────────────────────────────────
Write-Step "Checking Python 3.12+"

$PYTHON = $null
foreach ($cmd in @("python3.14", "python3.13", "python3.12", "python3", "python")) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        $verOut = & $cmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $parts = $verOut.Split(".")
            if ([int]$parts[0] -eq 3 -and [int]$parts[1] -ge 12) {
                $PYTHON = $cmd
                $PYTHON_VER = $verOut.Trim()
                break
            }
        }
    }
}

if (-not $PYTHON) {
    Write-Fail "Python 3.12 or newer is required but not found.
    Install it from https://www.python.org/downloads/
    Make sure to check 'Add Python to PATH' during installation.
    Then run this script again."
}
Write-Ok "Found $PYTHON ($PYTHON_VER)"

# ── Step 2: Check Node.js ─────────────────────────────────────────────────────
Write-Step "Checking Node.js 18+"

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js is required but not found.
    Install it from https://nodejs.org/ (choose LTS)
    Make sure to check 'Add to PATH' during installation.
    Then run this script again."
}

$NODE_VER = (node -e "process.stdout.write(process.versions.node)").Trim()
$NODE_MAJOR = [int]($NODE_VER.Split(".")[0])
if ($NODE_MAJOR -lt 18) {
    Write-Fail "Node.js 18 or newer is required. Found: $NODE_VER
    Update from https://nodejs.org/"
}
Write-Ok "Found node $NODE_VER"

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Fail "npm not found. It should come with Node.js — reinstall Node from https://nodejs.org/"
}
Write-Ok "Found npm $(npm --version)"

# ── Step 3: Check Ollama ──────────────────────────────────────────────────────
Write-Step "Checking Ollama"

if (-not (Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Fail "Ollama is required but not found.
    Install it from https://ollama.com
    Then run this script again."
}
Write-Ok "Found ollama"

# Check if Ollama service is running
try {
    $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3
    Write-Ok "Ollama service is running"
} catch {
    Write-Warn "Ollama service not running. Starting it..."
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3
        Write-Ok "Ollama service started"
    } catch {
        Write-Fail "Could not start Ollama service.
        Please start it manually: open Ollama from the Start menu or run 'ollama serve'
        Then run this script again."
    }
}

# ── Step 4: Python virtual environment ───────────────────────────────────────
Write-Step "Setting up Python virtual environment"

$VENV = Join-Path $ROOT "venv"
if (-not (Test-Path $VENV)) {
    & $PYTHON -m venv $VENV
    Write-Ok "Created venv at $VENV"
} else {
    Write-Ok "venv already exists"
}

$PYTHON_VENV = Join-Path $VENV "Scripts\python.exe"
$PIP_VENV    = Join-Path $VENV "Scripts\pip.exe"

Write-Ok "Venv ready"

# ── Step 5: Install backend dependencies ─────────────────────────────────────
Write-Step "Installing backend dependencies"

& $PIP_VENV install --quiet --upgrade pip
& $PIP_VENV install --quiet -r (Join-Path $ROOT "backend\requirements.txt")
Write-Ok "Backend dependencies installed"

# ── Step 6: Copy .env if missing ─────────────────────────────────────────────
Write-Step "Configuring environment"

$ENV_FILE    = Join-Path $ROOT "backend\.env"
$ENV_EXAMPLE = Join-Path $ROOT "backend\.env.example"
if (-not (Test-Path $ENV_FILE)) {
    Copy-Item $ENV_EXAMPLE $ENV_FILE
    Write-Ok "Created backend\.env from .env.example"
} else {
    Write-Ok "backend\.env already exists"
}

# ── Step 7: Build frontend ────────────────────────────────────────────────────
Write-Step "Installing and building frontend"

Push-Location (Join-Path $ROOT "frontend")
npm install --silent
Write-Ok "Frontend dependencies installed"
npm run build
Write-Ok "Frontend built"
Pop-Location

# ── Step 8: Pull Ollama models ───────────────────────────────────────────────
Write-Step "Pulling Ollama models (~5.5 GB)"
Write-Host "  This may take 10-30 minutes depending on your internet speed."
Write-Host ""

$ollamaList = ollama list 2>$null

if ($ollamaList -notmatch "qwen2.5:7b") {
    Write-Host "  Pulling qwen2.5:7b..."
    ollama pull qwen2.5:7b
    Write-Ok "qwen2.5:7b downloaded"
} else {
    Write-Ok "qwen2.5:7b already downloaded"
}

if ($ollamaList -notmatch "nomic-embed-text") {
    Write-Host "  Pulling nomic-embed-text..."
    ollama pull nomic-embed-text
    Write-Ok "nomic-embed-text downloaded"
} else {
    Write-Ok "nomic-embed-text already downloaded"
}

# ── Step 9: Seed database ────────────────────────────────────────────────────
Write-Step "Seeding database with default labels"

& $PYTHON_VENV (Join-Path $ROOT "scripts\seed_labels.py")
Write-Ok "Labels seeded"

# ── Step 10: Create start.bat launcher ───────────────────────────────────────
Write-Step "Creating start.bat launcher"

$startBat = Join-Path $ROOT "start.bat"
@"
@echo off
REM start.bat — Launch Finance Tracker
REM Run this every time you want to start the app.

setlocal

set ROOT=%~dp0
set PORT=8000
set PYTHON_VENV=%ROOT%venv\Scripts\python.exe
set UVICORN=%ROOT%venv\Scripts\uvicorn.exe

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Finance Tracker
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Free port 8000 if in use
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo   Freeing port %PORT% (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

REM Ensure Ollama is running (try to start silently)
curl -sf http://localhost:11434/api/tags >nul 2>&1 || (
    echo   Starting Ollama...
    start "" /B ollama serve
    timeout /t 4 /nobreak >nul
)

REM Start Vite dev server in a new window
echo   Starting frontend...
start "Finance Tracker - Frontend" /MIN cmd /c "cd /d %ROOT%frontend && npm run dev"

REM Wait a moment then open browser
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo   Backend  -^> http://localhost:%PORT%
echo   Frontend -^> http://localhost:5173
echo.
echo   Close this window to stop the backend.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d %ROOT%backend
%UVICORN% app.main:app --port %PORT%
"@ | Set-Content $startBat -Encoding ASCII

Write-Ok "Created start.bat"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  To start Finance Tracker, double-click:"
Write-Host "    start.bat"
Write-Host ""
Write-Host "  Or run in PowerShell:"
Write-Host "    .\start.bat"
Write-Host ""
Write-Host "  Then open: http://localhost:5173"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
