"""
scripts/seed_labels.py
Pre-populates labels grouped by nature with correct color palette.
Safe to re-run — updates colors/nature on existing slugs.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.database import SessionLocal, create_tables
from app.db.models import Label
from sqlalchemy import func

LABELS = [
    # ── expense: reds · oranges · yellows · pinks · peach ─────────────────
    {"name": "Food & dining",       "slug": "food_dining",       "color": "#E24B4A", "nature": "expense"},
    {"name": "Groceries",           "slug": "groceries",         "color": "#D85A30", "nature": "expense"},
    {"name": "Transport",           "slug": "transport",         "color": "#EF9F27", "nature": "expense"},
    {"name": "Fuel",                "slug": "fuel",              "color": "#BA7517", "nature": "expense"},
    {"name": "Utilities",           "slug": "utilities",         "color": "#FAC775", "nature": "expense"},
    {"name": "Mobile & internet",   "slug": "mobile_internet",   "color": "#D4537E", "nature": "expense"},
    {"name": "Insurance",           "slug": "insurance",         "color": "#ED93B1", "nature": "expense"},
    {"name": "Shopping",            "slug": "shopping",          "color": "#F0997B", "nature": "expense"},
    {"name": "Health & medical",    "slug": "health_medical",    "color": "#F09595", "nature": "expense"},
    {"name": "Travel & hotels",     "slug": "travel_hotels",     "color": "#F7C1C1", "nature": "expense"},
    {"name": "Entertainment",       "slug": "entertainment",     "color": "#F5C4B3", "nature": "expense"},
    {"name": "Education",           "slug": "education",         "color": "#F4C0D1", "nature": "expense"},
    {"name": "Tax",                 "slug": "tax",               "color": "#791F1F", "nature": "expense"},
    {"name": "Rent",                "slug": "rent",              "color": "#993C1D", "nature": "expense"},
    {"name": "Other expense",       "slug": "other",             "color": "#EF9F27", "nature": "expense"},
    {"name": "ATM withdrawal",      "slug": "atm_withdrawal",    "color": "#F5C4B3", "nature": "expense"},

    # ── income: greens ────────────────────────────────────────────────────
    {"name": "Salary",              "slug": "salary",            "color": "#639922", "nature": "income"},
    {"name": "Dividend",            "slug": "dividend",          "color": "#1D9E75", "nature": "income"},
    {"name": "Interest earned",     "slug": "interest_earned",   "color": "#97C459", "nature": "income"},
    {"name": "Other income",        "slug": "other_income",      "color": "#5DCAA5", "nature": "income"},

    # ── investment: blues ─────────────────────────────────────────────────
    {"name": "Investment (out)",    "slug": "investment_out",    "color": "#185FA5", "nature": "investment"},
    {"name": "Withdrawal (in)",     "slug": "investment_in",     "color": "#5DCAA5", "nature": "investment"},

    # ── lending: ambers ───────────────────────────────────────────────────
    {"name": "Money out",           "slug": "lending_out",       "color": "#BA7517", "nature": "lending"},
    {"name": "Money in",            "slug": "lending_in",        "color": "#FAC775", "nature": "lending"},

    # ── transfer: greys ───────────────────────────────────────────────────
    {"name": "Credit card bill payment", "slug": "cc_payment",   "color": "#888780", "nature": "transfer"},
    {"name": "Self transfer",       "slug": "self_transfer",     "color": "#B4B2A9", "nature": "transfer"},
    {"name": "Returns",             "slug": "returns",           "color": "#D3D1C7", "nature": "transfer"},
]


def seed():
    create_tables()
    db = SessionLocal()
    added = 0
    updated = 0

    try:
        for item in LABELS:
            existing = db.query(Label).filter(Label.slug == item["slug"]).first()
            if existing:
                # update color and nature in case they changed
                existing.color  = item["color"]
                existing.nature = item["nature"]
                existing.name   = item["name"]
                updated += 1
            else:
                db.add(Label(**item))
                added += 1

        db.commit()
        print(f"Seeded {added} new labels, updated {updated} existing.")

        counts = db.query(Label.nature, func.count(Label.id)).group_by(Label.nature).all()
        for nature, count in sorted(counts):
            print(f"  {nature}: {count} labels")
    finally:
        db.close()


if __name__ == "__main__":
    seed()