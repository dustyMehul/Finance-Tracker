# install.ps1 — Finance Tracker setup for Windows (PowerShell)
#
# Prerequisites before running:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# Usage:
#   .\install.ps1

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "`n  [XX] $msg`n" -ForegroundColor Red; exit 1 }
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }

function Confirm-YN {
    param($prompt)
    $ans = Read-Host "  $prompt [Y/n]"
    return ($ans -eq "" -or $ans -match "^[Yy]")
}

function Ask-Input {
    param($prompt)
    return (Read-Host "  $prompt").Trim()
}

function Test-OllamaService {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3
        return $true
    } catch { return $false }
}

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Finance Tracker — Installer (Windows)" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "  This will set up everything needed to run Finance Tracker."
Write-Host "  The AI models alone are ~5.5 GB — have a stable connection."
Write-Host ""

# ── Port configuration ────────────────────────────────────────────────────────
Write-Step "Port configuration"

$inputBackend = Ask-Input "Backend port (API server) [default: 8000]"
$BACKEND_PORT = if ($inputBackend -eq "") { "8000" } else { $inputBackend }
Write-Ok "Backend port: $BACKEND_PORT"

$inputFrontend = Ask-Input "Frontend port (web UI)    [default: 5173]"
$FRONTEND_PORT = if ($inputFrontend -eq "") { "5173" } else { $inputFrontend }
Write-Ok "Frontend port: $FRONTEND_PORT"

# ── Step 1: Python ────────────────────────────────────────────────────────────
Write-Step "Python 3.12+"

$PYTHON = $null

if (Confirm-YN "Is Python 3.12 or newer already installed on this machine?") {
    # Try to auto-detect
    $detected = $null
    foreach ($cmd in @("python3.14", "python3.13", "python3.12", "python3", "python")) {
        $found = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($found) {
            $verOut = & $cmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1
            if ($LASTEXITCODE -eq 0) {
                $parts = $verOut.Trim().Split(".")
                if ([int]$parts[0] -eq 3 -and [int]$parts[1] -ge 12) {
                    $detected = $found.Source
                    $detectedVer = $verOut.Trim()
                    break
                }
            }
        }
    }

    if ($detected) {
        Write-Warn "Auto-detected: $detected ($detectedVer)"
        if (Confirm-YN "  Use this?") {
            $PYTHON = $detected
            $PYTHON_VER = $detectedVer
        }
    }

    if (-not $PYTHON) {
        $customPython = Ask-Input "  Enter full path to python.exe (e.g. C:\Python312\python.exe)"
        if (-not (Test-Path $customPython)) {
            Write-Fail "Path not found: $customPython"
        }
        $verOut = & $customPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1
        if ($LASTEXITCODE -ne 0) { Write-Fail "Could not run: $customPython" }
        $parts = $verOut.Trim().Split(".")
        if (-not ([int]$parts[0] -eq 3 -and [int]$parts[1] -ge 12)) {
            Write-Fail "Python 3.12+ required, but $customPython is version $($verOut.Trim())"
        }
        $PYTHON = $customPython
        $PYTHON_VER = $verOut.Trim()
    }
    Write-Ok "Using Python: $PYTHON ($PYTHON_VER)"

} else {
    Write-Host ""
    Write-Host "  Install Python 3.12+ from one of these sources:" -ForegroundColor Yellow
    Write-Host "    https://www.python.org/downloads/"
    Write-Host "    IMPORTANT: Check 'Add Python to PATH' during installation."
    Write-Host ""
    Write-Host "  Or via winget (run in PowerShell as Admin):"
    Write-Host "    winget install Python.Python.3.12"
    Write-Host ""

    if (Confirm-YN "  Install via winget now?") {
        winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $PYTHON = (Get-Command python -ErrorAction SilentlyContinue)?.Source
        if (-not $PYTHON) {
            Write-Fail "Python installed but not found in PATH. Close this window, reopen PowerShell, and run .\install.ps1 again."
        }
        $PYTHON_VER = (& $PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')").Trim()
        Write-Ok "Installed Python: $PYTHON ($PYTHON_VER)"
    } else {
        Write-Fail "Python 3.12+ is required. Install it and run .\install.ps1 again."
    }
}

# ── Step 2: Node.js ───────────────────────────────────────────────────────────
Write-Step "Node.js 18+"

$NODE = $null
$NPM  = $null

if (Confirm-YN "Is Node.js 18 or newer already installed?") {
    $detected = (Get-Command node -ErrorAction SilentlyContinue)?.Source

    if ($detected) {
        $nodeVer = (node -e "process.stdout.write(process.versions.node)").Trim()
        Write-Warn "Auto-detected: $detected ($nodeVer)"
        if (Confirm-YN "  Use this?") {
            $NODE = $detected
            $NODE_VER = $nodeVer
        }
    }

    if (-not $NODE) {
        $customNode = Ask-Input "  Enter full path to node.exe (e.g. C:\Program Files\nodejs\node.exe)"
        if (-not (Test-Path $customNode)) { Write-Fail "Path not found: $customNode" }
        $NODE = $customNode
        $NODE_VER = (& $NODE -e "process.stdout.write(process.versions.node)").Trim()
    }

    $nodeMajor = [int]($NODE_VER.Split(".")[0])
    if ($nodeMajor -lt 18) {
        Write-Fail "Node.js 18+ required, found $NODE_VER. Update from https://nodejs.org/"
    }

    $npmDir = Split-Path $NODE -Parent
    $NPM = Join-Path $npmDir "npm.cmd"
    if (-not (Test-Path $NPM)) { $NPM = (Get-Command npm -ErrorAction SilentlyContinue)?.Source }
    if (-not $NPM) { Write-Fail "npm not found. Reinstall Node.js from https://nodejs.org/" }
    Write-Ok "Using node: $NODE ($NODE_VER), npm: $NPM"

} else {
    Write-Host ""
    Write-Host "  Install Node.js 18+ (LTS) from:" -ForegroundColor Yellow
    Write-Host "    https://nodejs.org/"
    Write-Host "    Accept the default installation options."
    Write-Host ""
    Write-Host "  Or via winget:"
    Write-Host "    winget install OpenJS.NodeJS.LTS"
    Write-Host ""

    if (Confirm-YN "  Install via winget now?") {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $NODE = (Get-Command node -ErrorAction SilentlyContinue)?.Source
        $NPM  = (Get-Command npm  -ErrorAction SilentlyContinue)?.Source
        if (-not $NODE) {
            Write-Fail "Node installed but not found in PATH. Close this window, reopen PowerShell, and run .\install.ps1 again."
        }
        $NODE_VER = (& $NODE -e "process.stdout.write(process.versions.node)").Trim()
        Write-Ok "Installed Node: $NODE ($NODE_VER)"
    } else {
        Write-Fail "Node.js 18+ is required. Install it and run .\install.ps1 again."
    }
}

# ── Step 3: Ollama ────────────────────────────────────────────────────────────
Write-Step "Ollama (local AI)"

$OLLAMA = $null

if (Confirm-YN "Is Ollama already installed?") {
    $detected = (Get-Command ollama -ErrorAction SilentlyContinue)?.Source

    if ($detected) {
        Write-Warn "Auto-detected: $detected"
        if (Confirm-YN "  Use this?") {
            $OLLAMA = $detected
        }
    }

    if (-not $OLLAMA) {
        $customOllama = Ask-Input "  Enter full path to ollama.exe (e.g. C:\Users\You\AppData\Local\Programs\Ollama\ollama.exe)"
        if (-not (Test-Path $customOllama)) { Write-Fail "Path not found: $customOllama" }
        $OLLAMA = $customOllama
    }
    Write-Ok "Using Ollama: $OLLAMA"

} else {
    Write-Host ""
    Write-Host "  Install Ollama from:" -ForegroundColor Yellow
    Write-Host "    https://ollama.com"
    Write-Host "    Download and run the Windows installer."
    Write-Host "    Ollama will run as a background service automatically."
    Write-Host ""
    Write-Fail "Ollama is required. Install it from https://ollama.com, then run .\install.ps1 again."
}

# Ensure Ollama service is running
if (-not (Test-OllamaService)) {
    Write-Warn "Ollama service not running — starting it..."
    Start-Process $OLLAMA -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    if (-not (Test-OllamaService)) {
        Write-Fail "Could not start Ollama. Open the Ollama app from the Start menu, then retry."
    }
}
Write-Ok "Ollama service is running"

# ── Step 4: Python virtual environment ───────────────────────────────────────
Write-Step "Python virtual environment"

$VENV       = Join-Path $ROOT "venv"
$PYTHON_VENV = Join-Path $VENV "Scripts\python.exe"
$PIP_VENV    = Join-Path $VENV "Scripts\pip.exe"
$UVICORN_VENV= Join-Path $VENV "Scripts\uvicorn.exe"

if (Test-Path $VENV) {
    Write-Warn "venv already exists at $VENV"
    if (-not (Confirm-YN "  Re-use it?")) {
        Remove-Item -Recurse -Force $VENV
        & $PYTHON -m venv $VENV
        Write-Ok "Re-created venv"
    } else {
        Write-Ok "Re-using existing venv"
    }
} else {
    & $PYTHON -m venv $VENV
    Write-Ok "Created venv at $VENV"
}

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
    Write-Ok "backend\.env already exists — leaving it unchanged"
}

# ── Step 7: Build frontend ────────────────────────────────────────────────────
Write-Step "Building frontend"

Push-Location (Join-Path $ROOT "frontend")
& $NPM install --silent
Write-Ok "Frontend dependencies installed"
& $NPM run build
Write-Ok "Frontend built"
Pop-Location

# ── Step 8: Pull Ollama models ───────────────────────────────────────────────
Write-Step "Pulling AI models (~5.5 GB total)"
Write-Host "  This may take 10-30 minutes depending on your internet speed."
Write-Host ""

$ollamaList = & $OLLAMA list 2>$null

foreach ($model in @("qwen2.5:7b", "nomic-embed-text")) {
    if ($ollamaList -match [regex]::Escape($model)) {
        Write-Ok "$model already downloaded"
    } else {
        Write-Host "  Downloading $model..."
        & $OLLAMA pull $model
        Write-Ok "$model downloaded"
    }
}

# ── Step 9: Seed database ────────────────────────────────────────────────────
Write-Step "Seeding database"

& $PYTHON_VENV (Join-Path $ROOT "scripts\seed_labels.py")
Write-Ok "Default labels seeded"

# ── Step 10: Generate start.bat ───────────────────────────────────────────────
Write-Step "Generating start.bat launcher"

$startBat = Join-Path $ROOT "start.bat"
@"
@echo off
REM start.bat — Launch Finance Tracker
REM Run this every time you want to start the app.

setlocal

set ROOT=%~dp0
set BACKEND_PORT=$BACKEND_PORT
set FRONTEND_PORT=$FRONTEND_PORT
set UVICORN=$UVICORN_VENV
set OLLAMA=$OLLAMA
set NPM=$NPM

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Finance Tracker
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Free backend port if in use
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING 2^>nul') do (
    echo   Freeing port %BACKEND_PORT% ^(PID %%a^)...
    taskkill /PID %%a /F >nul 2>&1
)

REM Ensure Ollama is running
curl -sf http://localhost:11434/api/tags >nul 2>&1 || (
    echo   Starting Ollama...
    start "" /B "%OLLAMA%" serve
    timeout /t 4 /nobreak >nul
)

REM Start frontend dev server in a background window
echo   Starting frontend on port %FRONTEND_PORT%...
start "Finance Tracker - Frontend" /MIN cmd /c "cd /d %ROOT%frontend && set PORT=%FRONTEND_PORT% && "%NPM%" run dev -- --port %FRONTEND_PORT%"

REM Open browser after short delay
timeout /t 4 /nobreak >nul
start http://localhost:%FRONTEND_PORT%

echo   Backend  -^> http://localhost:%BACKEND_PORT%
echo   Frontend -^> http://localhost:%FRONTEND_PORT%
echo.
echo   Close this window to stop the backend.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d %ROOT%backend
"%UVICORN%" app.main:app --port %BACKEND_PORT%
"@ | Set-Content $startBat -Encoding ASCII

Write-Ok "Generated start.bat (ports: backend=$BACKEND_PORT, frontend=$FRONTEND_PORT)"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  To launch Finance Tracker, double-click:"
Write-Host "    start.bat"
Write-Host ""
Write-Host "  Then open: http://localhost:$FRONTEND_PORT"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
