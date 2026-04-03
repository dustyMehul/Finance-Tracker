import os
import glob as _glob
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings
from app.db.models import Base


# SQLite URL — swap to postgresql://... later with no other changes
DATABASE_URL = f"sqlite:///{settings.db_path}"

engine = create_engine(
    DATABASE_URL,
    # SQLite-specific: allow the same connection to be used across threads
    # (needed because FastAPI runs handlers in a threadpool)
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _run_migrations():
    """Apply any pending .sql migrations from the migrations folder."""
    migrations_dir = Path(__file__).parent / "migrations"
    sql_files = sorted(_glob.glob(str(migrations_dir / "*.sql")))
    with engine.connect() as conn:
        # Create tracking table if needed
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(filename TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ))
        conn.commit()
        applied = {row[0] for row in conn.execute(text("SELECT filename FROM schema_migrations"))}
        for path in sql_files:
            filename = os.path.basename(path)
            if filename in applied:
                continue
            sql = Path(path).read_text()
            for statement in sql.split(";"):
                stmt = statement.strip()
                if stmt and not stmt.startswith("--"):
                    try:
                        conn.execute(text(stmt))
                    except Exception:
                        pass  # column already exists (SQLite has no IF NOT EXISTS for ALTER)
            conn.execute(text("INSERT INTO schema_migrations (filename) VALUES (:f)"), {"f": filename})
            conn.commit()


def create_tables():
    """Create all tables and apply pending migrations. Called once at startup."""
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency — yields a DB session per request, always closes it.

    Usage in a router:
        @router.get("/things")
        def list_things(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
