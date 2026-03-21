# Finance-Tracker
A project for locally maintaining personal finance (bank and credit card statements)
finance-tracker/
├── frontend/                                # UI / frontend
│   ├── src/
│   │   ├── pages/                           # Route-level pages
│   │   │   ├── Upload.tsx                   # File drop + per-file metadata form
│   │   │   ├── Reconcile.tsx                # Review, edit, ignore transactions
│   │   │   ├── Labels.tsx                   # Add/edit category label list
│   │   │   └── Reports.tsx                  # Charts, summaries, export
│   │   │
│   │   ├── components/                      # Reusable UI components
│   │   │   ├── DropZone.tsx                 # Drag-and-drop with file type validation
│   │   │   ├── FileList.tsx                 # Per-file status: ready / dup / error
│   │   │   ├── MetaForm.tsx                 # Bank, account type, nickname fields
│   │   │   ├── TransactionTable.tsx         # Sortable, filterable, inline-edit table
│   │   │   ├── CategoryBadge.tsx            # Label pill with LLM confidence score
│   │   │   └── ReportChart.tsx              # Recharts wrapper for spend breakdowns
│   │   │
│   │   ├── api/
│   │   │   └── client.ts                    # Typed fetch wrappers for backend routes
│   │   │
│   │   ├── types/
│   │   │   └── index.ts                     # Transaction, Label, UploadJob, PipelineStatus
│   │   │
│   │   └── main.tsx                         # App entrypoint + router setup
│   │
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                                 # API / backend
│   ├── app/
│   │   ├── main.py                          # FastAPI init, router mounting, CORS
│   │   │
│   │   ├── core/                            # Config / infra
│   │   │   ├── config.py                    # BaseSettings: DB_PATH, OLLAMA_HOST, UPLOAD_DIR, LOG_LEVEL
│   │   │   └── logging.py                   # Structured logger shared across modules
│   │   │
│   │   ├── routers/                         # API routes
│   │   │   ├── upload.py                    # POST /upload -> trigger pipeline job
│   │   │   ├── transactions.py              # GET / PATCH / DELETE /transactions
│   │   │   ├── labels.py                    # GET / POST / PATCH / DELETE /labels
│   │   │   └── reports.py                   # GET /reports with period/category aggregations
│   │   │
│   │   ├── pipeline/                        # Processing pipeline
│   │   │   ├── steps/
│   │   │   │   ├── base.py                  # PipelineStep ABC with .run(ctx)
│   │   │   │   ├── parser.py                # CSV / PDF / OFX -> List[RawTransaction]
│   │   │   │   ├── enricher.py              # Dedup, clean descriptions, flag returns
│   │   │   │   └── categorizer.py           # Vector match first, Ollama fallback
│   │   │   │
│   │   │   ├── context.py                   # PipelineContext dataclass shared across steps
│   │   │   ├── runner.py                    # Ordered STEPS list, iterates through ctx
│   │   │   └── __init__.py                  # Exports run_pipeline(job_id)
│   │   │
│   │   ├── ai/                              # AI / Ollama integration
│   │   │   ├── ollama_client.py             # Prompt templates + /api/generate calls
│   │   │   └── embedder.py                  # Embeddings via Ollama or sentence-transformers
│   │   │
│   │   ├── db/                              # Storage layer
│   │   │   ├── database.py                  # SQLAlchemy engine, session factory, get_db()
│   │   │   ├── models.py                    # ORM models: Transaction, Label, UploadJob
│   │   │   ├── vector_store.py              # ChromaDB upsert + similarity query
│   │   │   └── migrations/                  # Alembic migrations
│   │   │       ├── env.py
│   │   │       ├── script.py.mako
│   │   │       └── versions/
│   │   │
│   │   └── schemas/
│   │       └── schemas.py                   # Pydantic request/response models
│   │
│   ├── requirements.txt
│   └── pyproject.toml
│
├── data/                                    # Local storage (entire folder gitignored)
│   ├── finance.db                           # SQLite database file
│   ├── uploads/                             # Raw statement files saved on ingest
│   └── chroma/                              # Persisted ChromaDB vector store
│
├── scripts/                                 # Dev utilities / setup scripts
│   ├── seed_labels.py                       # Pre-populate default labels
│   ├── reset_db.py                          # Wipe + recreate tables (dev only)
│   └── test_parser.py                       # Smoke test for sample statement parsing
│
├── docker-compose.yml                       # Run backend + Ollama together
├── .env.example                             # OLLAMA_HOST, DB_PATH, UPLOAD_DIR, LOG_LEVEL
├── .gitignore                               # data/, __pycache__/, node_modules/, .env
└── README.md