"""
scripts/reset_db.py

Wipes and recreates all database tables.
Also clears the ChromaDB vector store.

USE WITH CAUTION — all transactions, labels, and upload jobs will be deleted.

Run from project root:
    python scripts/reset_db.py

Pass --confirm to skip the confirmation prompt (useful in dev scripts):
    python scripts/reset_db.py --confirm
"""

import sys
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.database import engine
from app.db.models import Base
from app.core.config import settings


def reset(confirmed: bool = False):
    if not confirmed:
        print("WARNING: This will delete ALL transactions, labels, and upload jobs.")
        print(f"  DB file   : {settings.db_path}")
        print(f"  Chroma dir: {settings.chroma_dir}")
        answer = input("\nType 'yes' to continue: ").strip().lower()
        if answer != "yes":
            print("Aborted.")
            return

    # --- drop and recreate all SQL tables ---
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ SQL database reset.")

    # ChromaDB removed — merchant rules now stored in SQLite (merchant_rules table)
    # No separate vector store to clear
    print("✓ Merchant rules cleared (part of SQL DB reset).")

    print("\nDone. Run 'python scripts/seed_labels.py' to re-populate labels.")


if __name__ == "__main__":
    confirmed = "--confirm" in sys.argv
    reset(confirmed=confirmed)