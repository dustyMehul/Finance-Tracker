"""
app/core/backup.py

Database backup utility.

Backup strategy:
  - Rolling backups: keep last 10 (named by timestamp)
  - Monthly backups: keep one per calendar month (named YYYY-MM)
    — never auto-deleted, accumulate indefinitely

Backup location: data/backups/
  data/backups/rolling/finance_20260323_165500.db
  data/backups/monthly/finance_2026-03.db

Triggered automatically after every successful upload.
Can also be run manually: python scripts/backup_db.py
"""

import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

ROLLING_DIR = Path(settings.db_path).parent / "backups" / "rolling"
MONTHLY_DIR = Path(settings.db_path).parent / "backups" / "monthly"
MAX_ROLLING  = 10


def backup(reason: str = "") -> Path | None:
    """
    Create a backup of finance.db.
    Returns the path of the backup file, or None if backup failed.

    - Always creates a rolling backup (pruned to MAX_ROLLING)
    - Creates/overwrites the monthly backup for the current month
    """
    if not settings.db_path.exists():
        logger.warning("Backup skipped — DB file not found at %s", settings.db_path)
        return None

    ROLLING_DIR.mkdir(parents=True, exist_ok=True)
    MONTHLY_DIR.mkdir(parents=True, exist_ok=True)

    now       = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    month_str = now.strftime("%Y-%m")

    # --- rolling backup ---
    rolling_path = ROLLING_DIR / f"finance_{timestamp}.db"
    try:
        shutil.copy2(settings.db_path, rolling_path)
        logger.info("Rolling backup created: %s%s",
                    rolling_path.name,
                    f" ({reason})" if reason else "")
    except Exception as e:
        logger.error("Rolling backup failed: %s", e)
        return None

    # --- prune old rolling backups ---
    _prune_rolling()

    # --- monthly backup ---
    monthly_path = MONTHLY_DIR / f"finance_{month_str}.db"
    try:
        shutil.copy2(settings.db_path, monthly_path)
        logger.info("Monthly backup updated: %s", monthly_path.name)
    except Exception as e:
        logger.warning("Monthly backup failed: %s", e)

    return rolling_path


def _prune_rolling():
    """Delete oldest rolling backups beyond MAX_ROLLING."""
    backups = sorted(ROLLING_DIR.glob("finance_*.db"))
    excess  = len(backups) - MAX_ROLLING
    if excess > 0:
        for old in backups[:excess]:
            try:
                old.unlink()
                logger.info("Pruned old backup: %s", old.name)
            except Exception as e:
                logger.warning("Could not prune backup %s: %s", old.name, e)


def list_backups() -> dict:
    """Return all available backups grouped by type."""
    rolling = sorted(ROLLING_DIR.glob("finance_*.db"), reverse=True) if ROLLING_DIR.exists() else []
    monthly = sorted(MONTHLY_DIR.glob("finance_*.db"), reverse=True) if MONTHLY_DIR.exists() else []
    return {
        "rolling": [str(p) for p in rolling],
        "monthly": [str(p) for p in monthly],
    }