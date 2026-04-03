<div align="center">

# 💰 Finance Tracker

**A local-first personal finance tracker — no cloud, no subscriptions, no data leaving your machine.**

Ingest bank statements · Auto-categorize with local AI · Reconcile & report

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Ollama](https://img.shields.io/badge/Ollama-local_AI-black?style=flat)](https://ollama.com)
[![SQLite](https://img.shields.io/badge/SQLite-local_DB-003B57?style=flat&logo=sqlite&logoColor=white)](https://sqlite.org)

</div>

---

## ✨ What it does

| | Feature |
|---|---|
| 📥 | **Import** XLS, CSV, PDF, and OFX bank statements |
| 🤖 | **Auto-categorize** using keyword rules → past corrections → local Ollama LLM |
| ✅ | **Reconcile** — review, edit, approve, or ignore before locking in |
| 🔄 | **Transfer detection** — auto-pairs account transfers and excludes them from reports |
| 📊 | **Reports** — spend by category, income, investments, trends, top merchants |
| 🗂️ | **Statements** — browse all uploads grouped by account |
| 🏦 | **Accounts & Labels** — manage accounts with bank/card details, customize categories |

---

## 🚀 Quick Start

### Prerequisites

> You need these three things installed before running setup.

| Tool | Min Version | Install |
|---|---|---|
| 🐍 Python | 3.12+ | `brew install python@3.12` · [python.org](https://python.org/downloads) |
| 🟩 Node.js | 18+ | `brew install node` · [nodejs.org](https://nodejs.org) |
| 🦙 Ollama | any | `brew install ollama` · [ollama.com](https://ollama.com) |

### 1. Run the installer

```bash
bash install.sh
```

The installer walks you through everything interactively:

```
▶ Port configuration       choose backend + frontend ports
▶ Python 3.12+             auto-detect or enter path
▶ Node.js 18+              auto-detect or enter path
▶ Ollama                   auto-detect or install via Homebrew
▶ Python virtual env       created at ./venv
▶ Backend dependencies     pip install from requirements.txt
▶ Frontend build           npm install + npm run build
▶ AI models (~5.5 GB)      pulls mistral + nomic-embed-text
▶ Database seed            default labels pre-populated
▶ Generates start.sh       your daily launcher
```

> ⏱️ The model download step can take 10–30 minutes on a typical connection.

### 2. Launch every time

```bash
bash start.sh
```

| Service | URL |
|---|---|
| 🖥️ App (UI) | `http://localhost:5173` |
| ⚙️ API | `http://localhost:8000` |
| 📖 API Docs | `http://localhost:8000/docs` |

Press `Ctrl+C` to stop everything.

---

## 📖 Using the App

### Step 1 — Set up accounts

> **Setup** (top right) → **Accounts** tab

Add each bank account or card you'll be importing statements for. Fields:
- Display name (e.g. `HDFC Savings`)
- Bank, account type, last 4 digits
- A color dot to distinguish accounts across the UI

---

### Step 2 — Import a statement

> **Import** page → drag & drop a file

Supported: `.xls` `.xlsx` `.csv` `.pdf` `.ofx`

Once uploaded, the pipeline runs automatically:

```
Parse file → Deduplicate → Detect nature → Categorize
                                              ↓
                              keyword rules (0.95 confidence)
                                              ↓
                              vector store — your past corrections (0.88+)
                                              ↓
                              Ollama LLM — mistral (0.70–0.75)
```

---

### Step 3 — Reconcile

> **Reconcile** page → review each transaction

| Action | What it does |
|---|---|
| ✅ Approve | Accept the auto-assigned category |
| ✏️ Edit | Change the nature and/or label |
| 🚫 Ignore | Exclude from reports |
| 🔒 Finalize | Lock the entire statement (requires 0 pending) |

> **Tip:** Manual corrections teach the AI — the same merchant will auto-categorize correctly in future imports.

---

### Step 4 — Confirm transfers

> **Transfers** page → review suggested pairs

The app finds transactions with the same amount within ±3 days across accounts. Confirm a pair to link them and exclude both sides from reports.

---

### Step 5 — Reports

> **Reports** page → tabbed dashboard

| Tab | Shows |
|---|---|
| Overview | Net cash flow, income vs spend |
| Categories | Expense breakdown by label — click a label to see transactions |
| Trends | Monthly spend over time |
| Merchants | Top merchants by spend |
| Investments | Cash in/out for investments |
| Money Lent | Lending tracker |

---

## 🛠️ Dev & Reset

### Everyday restarts

```bash
# Keep all data — just restart the server
bash scripts/restart.sh --no-reset

# Full wipe — reset DB, vector store, re-seed labels
bash scripts/restart.sh
```

> ⚠️ Always stop uvicorn before resetting. ChromaDB holds an in-memory singleton — resetting while it's running leaves stale embeddings.

### Manual full reset

```bash
# 1. Stop uvicorn (Ctrl+C)
rm -rf backend/data/chroma/ && mkdir backend/data/chroma/
python scripts/reset_db.py --confirm
python scripts/seed_labels.py

# 2. Restart
bash scripts/restart.sh --no-reset
```

### Useful scripts

```bash
# Smoke test the parser on a real file
python scripts/test_parser.py path/to/statement.xls

# Verify keyword rules match DB labels
python scripts/test_categorizer.py

# Manual DB backup / restore
python scripts/backup_db.py
python scripts/restore_db.py
```

---

## 🗂️ Repo Structure

```
Finance-Tracker/
├── 📁 backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── core/                # Config, logging, backup
│   │   ├── db/                  # ORM models, SQLite, ChromaDB vector store
│   │   ├── routers/             # upload · transactions · labels · reports · transfers
│   │   ├── pipeline/            # parser → enricher → categorizer
│   │   ├── ai/                  # Ollama client + embedder
│   │   └── schemas/             # Pydantic request/response models
│   ├── data/                    # Gitignored — DB, uploads, vector store, backups
│   └── requirements.txt
│
├── 📁 frontend/
│   └── src/
│       ├── pages/               # Upload · Reconcile · Transfers · Statements · Reports
│       ├── components/          # TransactionDrawer, shared UI
│       ├── api/client.ts        # Typed API wrappers
│       └── types/index.ts       # Shared TypeScript types
│
├── 📁 scripts/                  # seed · reset · backup · restore · smoke tests
├── install.sh                   # ← Run this first
├── start.sh                     # ← Run this daily (generated by install.sh)
└── CLAUDE.md                    # Project context for AI-assisted development
```

---

## ⚙️ Tech Stack

```
Frontend    Vite + React + TypeScript · Recharts · TanStack Query · React Router
Backend     FastAPI · SQLAlchemy · SQLite · ChromaDB · pydantic-settings
AI          Ollama (local) — mistral 7B for categorization
                           — nomic-embed-text for vector embeddings
Parsers     pdfplumber · ofxparse · pandas + xlrd
```
