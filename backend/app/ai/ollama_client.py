"""
ai/ollama_client.py

Transaction categorizer using Ollama.
Uses a simple single-word response format for reliability with small models.
"""

import httpx
import json
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# Keyword rules — applied BEFORE calling Ollama
# Handles the most common Indian transaction patterns deterministically
KEYWORD_RULES: list[tuple[list[str], str]] = [
    # credit card payment
    (["CC PAYMENT", "CREDIT CARD PAYMENT", "BPPY", "BILLDESK CC"], "cc_payment"),
    # utilities
    (["PZELECTRICITY", "ELECTRICITY", "BESCOM", "MSEDCL", "TPDDL", "BSES"], "utilities"),
    # mobile / internet
    (["PZPOSTPAID", "PZRECHARGE", "AIRTEL", "JIOFIBER", "BSNL", "VODAFONE", "VI ", "RECHARGE"], "mobile_internet"),
    # insurance
    (["PZINSURANCE", "INSURANCE", "LIC ", "HDFC LIFE", "ICICI PRU", "SBI LIFE"], "insurance"),
    # fuel
    (["BPCL", "HPCL", "IOCL", "INDIAN OIL", "PETROL", "BHARAT PETROLEUM", "NAYARA"], "fuel"),
    # tax
    (["CBDT", "INCOME TAX", "GST PAYMENT", "TDS PAYMENT"], "tax"),
    # groceries
    (["AVENUE SUPERMARTS", "DMART", "BIGBASKET", "GROFERS", "BLINKIT", "ZEPTO", "SWIGGY INSTAMART"], "groceries"),
    # food & dining
    (["MCDONALDS", "MC DONALDS", "ZOMATO", "SWIGGY", "DOMINOS", "PIZZA", "CAFE", "RESTAURANT", "DINING", "FOOD"], "food_dining"),
    # travel & hotels
    (["LEMON TREE", "HOTEL", "MAKEMYTRIP", "IRCTC", "CLEARTRIP", "GOIBIBO", "OYO", "AIRLINES", "INDIGO", "SPICEJET"], "travel_hotels"),
    # shopping
    (["DECATHLON", "AMAZON", "FLIPKART", "MYNTRA", "AJIO", "NYKAA", "GYFTR", "SMARTBUY"], "shopping"),
    # health
    (["PHARMACY", "HOSPITAL", "CLINIC", "APOLLO", "MEDPLUS", "NETMEDS", "1MG"], "health_medical"),
    # transport
    (["UBER", "OLA", "RAPIDO", "METRO", "NAMMA", "AUTO"], "transport"),
]


def _keyword_match(description: str) -> str | None:
    """Fast deterministic match before hitting Ollama."""
    desc_upper = description.upper()
    for keywords, slug in KEYWORD_RULES:
        if any(kw in desc_upper for kw in keywords):
            return slug
    return None


def categorize(description: str, label_slugs: list[str]) -> tuple[str, float]:
    """
    Categorize a transaction description.
    Tries keyword rules first, then falls back to Ollama.
    Returns (category_slug, confidence).
    """
    if not label_slugs:
        return "other", 0.0

    # fast path — keyword rules
    keyword_slug = _keyword_match(description)
    if keyword_slug and keyword_slug in label_slugs:
        logger.debug("Keyword match: '%s' → %s", description[:50], keyword_slug)
        return keyword_slug, 0.95

    # slow path — Ollama
    return _ollama_categorize(description, label_slugs)


def _ollama_categorize(description: str, label_slugs: list[str]) -> tuple[str, float]:
    """Call Ollama for transactions that didn't match any keyword rule."""

    slugs_formatted = "\n".join(f"- {s}" for s in label_slugs)

    prompt = f"""Which category best describes this bank transaction?

Transaction: "{description}"

Categories (reply with ONLY the slug, nothing else):
{slugs_formatted}

Your answer (one slug only):"""

    try:
        response = httpx.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.0,
                    "num_predict": 20,   # slug is short, no need for more
                }
            },
            timeout=30.0,
        )
        response.raise_for_status()
        raw = response.json().get("response", "").strip().lower()

        # clean up — model might add punctuation or extra words
        raw = raw.split("\n")[0].strip()
        raw = raw.strip("\"'.,;:")

        # find the first slug that appears in the response
        for slug in label_slugs:
            if slug in raw:
                logger.debug("Ollama match: '%s' → %s", description[:50], slug)
                return slug, 0.75

        # if nothing matched, default to other
        logger.warning("Ollama could not categorize: '%s' (raw: %s)", description[:50], raw[:40])
        return "other", 0.0

    except httpx.TimeoutException:
        logger.warning("Ollama timeout for: %s", description[:60])
        return "other", 0.0
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        return "other", 0.0