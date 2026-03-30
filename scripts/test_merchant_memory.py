"""
scripts/test_merchant_memory.py

Test merchant key extraction against your real transaction descriptions.
Run from project root:
    python scripts/test_merchant_memory.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.merchant_memory import extract_merchant_key

TEST_CASES = [
    # (description, expected_key_contains)
    ("UPI-BPCL RAJKAMAL ENTERPRI KOTA",          "BPCL RAJKAMAL"),
    ("UJAGAR SINGH SETHI AN DKOTA",              "UJAGAR SINGH SETHI"),
    ("UjagarsinghsethiandBro Kota",              "UJAGARSINGHSETHI"),
    ("THIRD WAVE COFFEE BANGALORE",              "THIRD WAVE COFFEE"),
    ("JAI SONS KOTA",                            "JAI SONS"),
    ("WWW DINEOUT CO IN GURGAON",               "WWW DINEOUT"),
    ("ALL SAINTS STORES BENGALURU UR",           "ALL SAINTS STORES"),
    ("ZUDIO A UNIT OF TRENT LBANGALORE",        "ZUDIO"),
    ("MAX RETAIL BANGALORE",                     "MAX RETAIL"),
    ("MAHASHAKTI FILING CENT KATNI",             "MAHASHAKTI FILING"),
    ("BPPY CC PAYMENT DP0160 44094304Wbrqv",    "BPPY CC PAYMENT"),
    ("PZELECTRICITY MUMBAI",                     "PZELECTRICITY"),
    ("AVENUE SUPERMARTS LTD KOTA",              "AVENUE SUPERMARTS"),
    ("ACH D- ZERODHA BROKING LTD-YNZQVG",      "ZERODHA BROKING"),
    ("IMPS-606348758076-TANUSHREESAHU-UTIB",    "TANUSHREESAHU"),
]

print(f"\n{'Description':<45} {'Extracted Key':<25} {'Contains?'}")
print("=" * 80)

passed = 0
failed = 0

for desc, expected_contains in TEST_CASES:
    key = extract_merchant_key(desc)
    contains = expected_contains.upper() in key.upper() or key.upper() in expected_contains.upper()
    mark = "✓" if contains else "✗"
    if contains:
        passed += 1
    else:
        failed += 1
    print(f"{desc[:44]:<45} {key:<25} {mark} (expected: {expected_contains})")

print(f"\n{passed} passed, {failed} failed out of {len(TEST_CASES)} tests")