"""
scripts/test_categorizer.py

Quick test to verify keyword rules work against the current DB labels.
Run from project root:
    python scripts/test_categorizer.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.database import SessionLocal
from app.db.models import Label
from app.ai.ollama_client import _keyword_match, categorize

# test descriptions from your HDFC credit card statement
TEST_CASES = [
    # (description, expected_slug, nature, transaction_type)
    ("CBDT GURGAON",                              "tax",            "expense", "debit"),
    ("PZELECTRICITY MUMBAI",                      "utilities",      "expense", "debit"),
    ("PZPOSTPAID MUMBAI",                         "mobile_internet","expense", "debit"),
    ("PZINSURANCE MUMBAI",                        "insurance",      "expense", "debit"),
    ("PZRECHARGE NON BBPS MUMBAI",               "mobile_internet","expense", "debit"),
    ("BPCL RAJKAMAL ENTERPRI KOTA",              "fuel",           "expense", "debit"),
    ("Bharat Petroleum Corpo Kota",              "fuel",           "expense", "debit"),
    ("MC DONALDS BENGALURU",                     "food_dining",    "expense", "debit"),
    ("LEMON TREE WILDLIFE RE SBANDHAVAGARH",     "travel_hotels",  "expense", "debit"),
    ("DECATHLON SPORTS INDIA BANGALORE",         "shopping",       "expense", "debit"),
    ("GYFTR VIA SMARTBUY NEW DELHI",             "shopping",       "expense", "debit"),
    ("AVENUE SUPERMARTS LTD KOTA",               "groceries",      "expense", "debit"),
    ("ACH D- ZERODHA BROKING LTD-YNZQVGMOXPEUR","investment_out", "investment","debit"),
]

def main():
    db = SessionLocal()
    labels = db.query(Label).filter(Label.is_active == True).all()
    db.close()

    slugs_by_nature: dict[str, list[str]] = {}
    for l in labels:
        slugs_by_nature.setdefault(l.nature, []).append(l.slug)

    print(f"\nLoaded {len(labels)} labels from DB")
    for nature, slugs in sorted(slugs_by_nature.items()):
        print(f"  {nature}: {slugs}")

    print(f"\n{'='*70}")
    print(f"{'Description':<45} {'Expected':<18} {'Got':<18} {'Match'}")
    print(f"{'='*70}")

    passed = 0
    failed = 0

    for desc, expected, nature, txn_type in TEST_CASES:
        # pick candidate slugs same way categorizer does
        if nature == "investment":
            if txn_type == "debit":
                candidates = [s for s in slugs_by_nature.get("investment", []) if "out" in s]
            else:
                candidates = [s for s in slugs_by_nature.get("investment", []) if "in" in s]
        else:
            candidates = slugs_by_nature.get(nature, [])

        # test keyword match first
        kw_slug = _keyword_match(desc, candidates)

        got = kw_slug or "→ ollama"
        match = "✓" if kw_slug == expected else "✗"
        if kw_slug == expected:
            passed += 1
        else:
            failed += 1

        print(f"{desc[:44]:<45} {expected:<18} {got:<18} {match}")
        if kw_slug != expected and not kw_slug:
            # show what candidates were available
            print(f"  {'':>44} candidates: {candidates}")

    print(f"\n{passed} passed, {failed} failed out of {len(TEST_CASES)} tests")

if __name__ == "__main__":
    main()