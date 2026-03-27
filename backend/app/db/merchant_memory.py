"""
db/merchant_memory.py

Deterministic merchant → label lookup table.
Replaces ChromaDB vector store entirely.

How it works:
  WRITE: when user manually corrects a label in Reconcile,
         extract_merchant_key(description) → store in merchant_rules table
  READ:  during import, check if any stored merchant_key appears
         in the transaction description → assign that label

Key extraction strips common UPI/NEFT prefixes and takes first 2-3 meaningful words.
Matching is substring-based (case insensitive) — fast, deterministic, no thresholds.

Examples:
  "UPI-BPCL RAJKAMAL ENTERPRI KOTA"   → key: "BPCL RAJKAMAL"     → fuel
  "THIRD WAVE COFFEE BANGALORE"        → key: "THIRD WAVE COFFEE" → food_dining
  "UJAGAR SINGH SETHI AN DKOTA"        → key: "UJAGAR SINGH"      → fuel
  "JAI SONS KOTA"                      → key: "JAI SONS"          → groceries
"""

import re
from sqlalchemy.orm import Session
from app.db.models import MerchantRule
from app.core.logging import get_logger

logger = get_logger(__name__)

# Prefixes to strip before extracting merchant key
_STRIP_PREFIXES = [
    r"^UPI[-\s]+",
    r"^IMPS[-\s]+\d+[-\s]+",
    r"^NEFT[-\s]+\w+[-\s]+",
    r"^ACH\s+[DC][-\s]+",
    r"^FT[-\s]+",
    r"^BPPY\s+",
    r"^MMT[-\s]+",
    r"^POS\s+",
    r"^\d{5,}\s+",  # leading transaction numbers
]

# Words to exclude from merchant key (noise words)
_NOISE_WORDS = {
    "PVT", "LTD", "LIMITED", "INDIA", "PRIVATE", "CORP", "CORPORATION",
    "BANGALORE", "BENGALURU", "MUMBAI", "DELHI", "GURGAON", "KOTA",
    "CHENNAI", "HYDERABAD", "PUNE", "KOLKATA", "NOIDA", "GURUGRAM",
    "CO", "IN", "AN", "THE", "AND", "OF", "FROM",
}


def extract_merchant_key(description: str, n_words: int = 3) -> str:
    """
    Extract a stable merchant key from a bank transaction description.
    Returns uppercase string of first n meaningful words.
    """
    text = description.upper().strip()

    # strip prefixes
    for pattern in _STRIP_PREFIXES:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()

    # split into words, filter noise
    words = [w for w in text.split() if w and w not in _NOISE_WORDS and len(w) > 1]

    # take first n words
    key = " ".join(words[:n_words]).strip()

    # remove trailing special chars
    key = re.sub(r"[^A-Z0-9\s]", "", key).strip()

    return key


def find_match(description: str, db: Session) -> tuple[str, float] | None:
    """
    Check if any stored merchant key appears in the description.
    Returns (label_slug, confidence) or None.

    Confidence is 0.90 — below keyword rules (0.95) but above Ollama (0.75).
    """
    desc_upper = description.upper()
    rules = db.query(MerchantRule).all()

    # try longer keys first — more specific matches win
    rules_sorted = sorted(rules, key=lambda r: len(r.merchant_key), reverse=True)

    for rule in rules_sorted:
        if rule.merchant_key in desc_upper:
            logger.debug(
                "Merchant memory hit: '%s' contains '%s' → %s",
                description[:50], rule.merchant_key, rule.label_slug
            )
            return rule.label_slug, 0.90

    return None


def store_rule(description: str, label_slug: str, label_id: str,
               source_txn_id: str, db: Session) -> str | None:
    """
    Extract merchant key from description and store/update in merchant_rules.
    Returns the merchant_key that was stored, or None if key was too short.
    """
    key = extract_merchant_key(description)

    if not key or len(key) < 3:
        logger.warning("Merchant key too short for: '%s' (got '%s')", description[:50], key)
        return None

    existing = db.query(MerchantRule).filter(
        MerchantRule.merchant_key == key
    ).first()

    if existing:
        # update if label changed
        if existing.label_slug != label_slug:
            logger.info(
                "Merchant rule updated: '%s' %s → %s",
                key, existing.label_slug, label_slug
            )
            existing.label_slug  = label_slug
            existing.label_id    = label_id
            existing.source_txn_id = source_txn_id
        db.commit()
    else:
        rule = MerchantRule(
            merchant_key   = key,
            label_slug     = label_slug,
            label_id       = label_id,
            source_txn_id  = source_txn_id,
        )
        db.add(rule)
        db.commit()
        logger.info("Merchant rule stored: '%s' → %s (from txn %s)",
                    key, label_slug, source_txn_id[:8])

    return key


def list_rules(db: Session) -> list[dict]:
    """Return all merchant rules sorted by key."""
    rules = db.query(MerchantRule).order_by(MerchantRule.merchant_key).all()
    return [
        {
            "id":           r.id,
            "merchant_key": r.merchant_key,
            "label_slug":   r.label_slug,
            "created_at":   str(r.created_at),
        }
        for r in rules
    ]


def delete_rule(merchant_key: str, db: Session) -> bool:
    """Delete a merchant rule by key. Returns True if deleted."""
    rule = db.query(MerchantRule).filter(
        MerchantRule.merchant_key == merchant_key
    ).first()
    if not rule:
        return False
    db.delete(rule)
    db.commit()
    logger.info("Merchant rule deleted: '%s'", merchant_key)
    return True