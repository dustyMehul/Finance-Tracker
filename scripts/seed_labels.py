"""
scripts/seed_labels.py

Pre-populates the labels table with common Indian personal finance categories.
Run once before first use:

    python scripts/seed_labels.py

Safe to re-run — skips labels that already exist.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.database import SessionLocal, create_tables
from app.db.models import Label

LABELS = [
    {"name": "Food & dining",       "slug": "food_dining",      "color": "#E85D24"},
    {"name": "Groceries",           "slug": "groceries",        "color": "#639922"},
    {"name": "Transport",           "slug": "transport",        "color": "#378ADD"},
    {"name": "Fuel",                "slug": "fuel",             "color": "#BA7517"},
    {"name": "Utilities",           "slug": "utilities",        "color": "#7F77DD"},
    {"name": "Mobile & internet",   "slug": "mobile_internet",  "color": "#1D9E75"},
    {"name": "Insurance",           "slug": "insurance",        "color": "#D85A30"},
    {"name": "Shopping",            "slug": "shopping",         "color": "#D4537E"},
    {"name": "Health & medical",    "slug": "health_medical",   "color": "#E24B4A"},
    {"name": "Travel & hotels",     "slug": "travel_hotels",    "color": "#0F6E56"},
    {"name": "Entertainment",       "slug": "entertainment",    "color": "#534AB7"},
    {"name": "Education",           "slug": "education",        "color": "#185FA5"},
    {"name": "Investments",         "slug": "investments",      "color": "#27500A"},
    {"name": "Tax",                 "slug": "tax",              "color": "#444441"},
    {"name": "Credit card payment", "slug": "cc_payment",       "color": "#888780"},
    {"name": "Transfer",            "slug": "transfer",         "color": "#B4B2A9"},
    {"name": "Other",               "slug": "other",            "color": "#D3D1C7"},
]


def seed():
    create_tables()
    db = SessionLocal()
    added = 0
    skipped = 0

    try:
        for item in LABELS:
            exists = db.query(Label).filter(Label.slug == item["slug"]).first()
            if exists:
                skipped += 1
                continue
            db.add(Label(**item))
            added += 1

        db.commit()
        print(f"Seeded {added} labels, skipped {skipped} existing.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()