from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import get_logger
from app.db.database import create_tables
from app.routers import upload, transactions, labels, reports, transfers

logger = get_logger("main")

app = FastAPI(title="Finance Tracker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(labels.router)
app.include_router(reports.router)
app.include_router(transfers.router)


@app.on_event("startup")
def on_startup():
    logger.info("Starting up — env: %s", settings.app_env)
    settings.ensure_dirs()
    create_tables()
    logger.info("DB and directories ready")


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}