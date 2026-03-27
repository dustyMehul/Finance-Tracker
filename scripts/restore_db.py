"""
scripts/backup_db.py

Manually trigger a database backup.
Run from project root:

    python scripts/backup_db.py

Useful for taking a manual snapshot before making changes.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.core.backup import backup, list_backups


def main():
    print("Creating backup...")
    path = backup(reason="manual")

    if path:
        print(f"✓ Backup created: {path}")
    else:
        print("✗ Backup failed — check logs.")
        sys.exit(1)

    print("\nAll available backups:")
    backups = list_backups()

    print(f"\n  Rolling ({len(backups['rolling'])} files):")
    for p in backups["rolling"]:
        print(f"    {Path(p).name}")

    print(f"\n  Monthly ({len(backups['monthly'])} files):")
    for p in backups["monthly"]:
        print(f"    {Path(p).name}")


if __name__ == "__main__":
    main()