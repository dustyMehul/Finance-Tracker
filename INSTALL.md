# Installing Finance Tracker Locally

Finance Tracker runs entirely on your machine — no internet connection needed after setup (except for the initial AI model download).

---

## What gets installed

| Component | Purpose | Download size |
|-----------|---------|--------------|
| Python 3.12+ | Runs the backend | ~30 MB |
| Node.js 18+ | Runs the frontend | ~70 MB |
| Ollama | Runs the local AI | ~200 MB |
| qwen2.5:7b (AI model) | Categorizes transactions | ~5 GB |
| nomic-embed-text (AI model) | Learns from your corrections | ~500 MB |

**Total disk space: ~6 GB**

---

## Mac / Linux

### 1. Install prerequisites

**Python 3.12+**
- Download from [python.org/downloads](https://www.python.org/downloads/) and run the installer
- Or with Homebrew: `brew install python@3.12`

**Node.js 18+**
- Download from [nodejs.org](https://nodejs.org/) (choose the LTS version)
- Or with Homebrew: `brew install node`

**Ollama**
- Download from [ollama.com](https://ollama.com) and run the installer
- After installing, open Terminal and verify it works: `ollama --version`

### 2. Run the installer

Open Terminal, navigate to the Finance Tracker folder, and run:

```bash
bash install.sh
```

The installer will ask you a series of questions:
- **Backend and frontend ports** — press Enter to accept the defaults (8000 / 5173)
- **For each tool (Python, Node, Ollama):** whether it's already installed
  - If yes: it auto-detects the path and asks you to confirm, or lets you enter a custom path
  - If no: it shows the install command and offers to run it via Homebrew

After answering, it will:
- Set up the Python environment and install dependencies
- Build the frontend
- Download the AI models (~5.5 GB — this is the slow step, be patient)
- Seed the database and generate a `start.sh` launcher

### 3. Start the app

```bash
bash start.sh
```

The app will open automatically in your browser at **http://localhost:5173**

---

## Windows

### 1. Install prerequisites

**Python 3.12+**
1. Download from [python.org/downloads](https://www.python.org/downloads/)
2. Run the installer — **important:** check the box that says "Add Python to PATH"
3. Open PowerShell and verify: `python --version`

**Node.js 18+**
1. Download from [nodejs.org](https://nodejs.org/) (choose the LTS version)
2. Run the installer — accept the default options
3. Open PowerShell and verify: `node --version`

**Ollama**
1. Download from [ollama.com](https://ollama.com) and run the installer
2. Ollama runs as a background service automatically on Windows
3. Open PowerShell and verify: `ollama --version`

### 2. Allow the installer script to run

Open **PowerShell as Administrator** and run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

> This allows locally-saved PowerShell scripts to run. It does not affect downloaded scripts.

### 3. Run the installer

Open PowerShell, navigate to the Finance Tracker folder, and run:

```powershell
.\install.ps1
```

The installer will ask you a series of questions:
- **Backend and frontend ports** — press Enter to accept the defaults (8000 / 5173)
- **For each tool (Python, Node, Ollama):** whether it's already installed
  - If yes: it auto-detects the path and asks you to confirm, or lets you enter a custom path
  - If no: it shows the download URL and offers to install via `winget`

After answering, it handles everything — including downloading the AI models (~5.5 GB).

### 4. Start the app

Double-click **start.bat**, or in PowerShell:

```powershell
.\start.bat
```

The app will open automatically in your browser at **http://localhost:5173**

---

## Troubleshooting

### "Python not found" / "Node not found"
Make sure you checked "Add to PATH" during installation. After installing, close and reopen your terminal/PowerShell window, then try again.

### "Ollama service is not running"
- **Mac/Linux:** Run `ollama serve` in a terminal window and keep it open, then retry.
- **Windows:** Open the Ollama app from the Start menu. It runs as a background service.

### Model download is very slow or fails
The models are large (~5.5 GB total). If the download fails partway, just run the installer again — Ollama will resume from where it left off.

### Port 8000 is already in use
Something else is running on port 8000. On Mac/Linux: `lsof -ti :8000 | xargs kill -9`. On Windows: find the process in Task Manager and end it.

### Frontend shows a blank page
The frontend build may have failed. Run `cd frontend && npm run build` manually to see the error.

### Categorization isn't working (all transactions show "other")
Ollama may not be running. Check that `ollama serve` is running and that you pulled both models:
```
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

---

## Updating

When you get a new version of Finance Tracker:

1. Stop the app (Ctrl+C in the terminal)
2. Pull the latest code (or replace the folder with the new version)
3. Run the installer again — it skips steps that are already done

```bash
bash install.sh   # Mac/Linux
.\install.ps1     # Windows
```

---

## Uninstalling

1. Delete the Finance Tracker folder
2. To remove the AI models: `ollama rm qwen2.5:7b && ollama rm nomic-embed-text`
3. To remove Ollama itself: uninstall via System Preferences (Mac) or Control Panel (Windows)
