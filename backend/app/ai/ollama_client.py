"""
ai/ollama_client.py

Keyword rules + Ollama fallback for transaction categorization.

IMPORTANT: keyword rule slugs must match slugs in seed_labels.py exactly.
The categorizer validates that the returned slug matches the candidate_slugs
for the transaction's financial_nature — so rules here must return the right
slug for the right nature.
"""

import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Keyword rules — first match wins, applied before Ollama
# Slugs must match seed_labels.py exactly
# ---------------------------------------------------------------------------

KEYWORD_RULES: list[tuple[list[str], str]] = [
    # ── expense: utilities ─────────────────────────────────────────────
    (["PZELECTRICITY", "ELECTRICITY", "BESCOM", "MSEDCL",
      "TPDDL", "BSES", "TORRENT POWER"], "utilities"),
    # ── expense: mobile & internet ─────────────────────────────────────
    (["PZPOSTPAID", "PZRECHARGE", "AIRTEL", "JIOFIBER", "BSNL",
      "VODAFONE", "VI ", "RECHARGE NON BBPS", "RECHARGE"], "mobile_internet"),
    # ── expense: insurance ─────────────────────────────────────────────
    (["PZINSURANCE", "INSURANCE", "LIC ", "LIC BILLDESK",
      "HDFC LIFE", "ICICI PRU", "SBI LIFE",
      "STAR HEALTH", "TATA AIG"], "insurance"),
    # ── expense: fuel ──────────────────────────────────────────────────
    (["BPCL", "HPCL", "IOCL", "INDIAN OIL", "PETROL",
      "BHARAT PETROLEUM", "NAYARA", "ESSAR OIL"], "fuel"),
    # ── expense: tax ───────────────────────────────────────────────────
    (["CBDT", "INCOME TAX", "GST PAYMENT", "TDS PAYMENT"], "tax"),
    # ── expense: groceries ─────────────────────────────────────────────
    (["AVENUE SUPERMARTS", "DMART", "BIGBASKET", "GROFERS",
      "BLINKIT", "ZEPTO", "SWIGGY INSTAMART",
      "KIRANA", "GROCER"], "groceries"),
    # ── expense: food & dining ─────────────────────────────────────────
    (["MCDONALDS", "MC DONALDS", "ZOMATO", "SWIGGY", "DOMINOS",
      "PIZZA", "CAFE", "RESTAURANT", "DINING", "BISTRO",
      "SARJAPU", "SCOTCH YARD", "HORTICULTU",
      "RAW FOODS", "BHARATPE"], "food_dining"),
    # ── expense: travel & hotels ───────────────────────────────────────
    (["LEMON TREE", "HOTEL", "MAKEMYTRIP", "IRCTC", "CLEARTRIP",
      "GOIBIBO", "OYO", "AIRLINES", "INDIGO",
      "SPICEJET", "ACH C- INDIAN RAILWAY"], "travel_hotels"),
    # ── expense: shopping ──────────────────────────────────────────────
    (["DECATHLON", "AMAZON", "FLIPKART", "MYNTRA", "AJIO",
      "NYKAA", "GYFTR", "SMARTBUY",
      "PIXEL MOTORS", "BEARDO"], "shopping"),
    # ── expense: health & medical ──────────────────────────────────────
    (["PHARMACY", "HOSPITAL", "CLINIC", "APOLLO", "MEDPLUS",
      "NETMEDS", "1MG", "PRACTO"], "health_medical"),
    # ── expense: transport ─────────────────────────────────────────────
    (["UBER", "OLA", "RAPIDO", "METRO", "NAMMA", "AUTO"], "transport"),
    # ── expense: rent ──────────────────────────────────────────────────
    (["HOUSE RENT", "HRA ", "RENT PAYMENT"], "rent"),
<<<<<<< Updated upstream
    # ── expense: education ─────────────────────────────────────────────
=======
    (["ATW ", "ATM ", "ATM WITHDRAWAL", "CASH WITHDRAWAL"], "atm_withdrawal"),
>>>>>>> Stashed changes
    (["SCHOOL FEE", "COLLEGE FEE", "TUITION", "UDEMY",
      "COURSERA", "UNACADEMY"], "education"),
    # ── expense: entertainment ─────────────────────────────────────────
    (["NETFLIX", "HOTSTAR", "PRIME VIDEO", "SPOTIFY",
      "BOOKMYSHOW", "PVR", "INOX"], "entertainment"),
    # ── investment: out (debit) ────────────────────────────────────────
    (["ZERODHA", "GROWW", "KUVERA", "SMALLCASE", "COIN BY ZERODHA",
      "NSE CLEARING", "BSE CLEARING", "INDIAN CLEARING CORP",
      "ACH D- ZERODHA", "ACH D- INDIAN CLEARING",
      "NSDL", "CDSL", "MUTUAL FUND", "MF-", "SIP-"], "investment_out"),
    # ── investment: in (credit) ────────────────────────────────────────
    # same keywords but direction handled by categorizer via txn_type
    # ── income: salary ─────────────────────────────────────────────────
    (["SALARY", "PAYROLL", "STIPEND"], "salary"),
    # ── income: dividend ───────────────────────────────────────────────
    (["DIVIDEND", "DIV CREDIT"], "dividend"),
    # ── income: interest ───────────────────────────────────────────────
    (["INTEREST CREDIT", "INTEREST EARNED",
      "INT. ON SWCR", "SWEEP-IN"], "interest_earned"),
]

<<<<<<< Updated upstream
=======
# Human-readable descriptions for Ollama prompt
SLUG_DESCRIPTIONS: dict[str, str] = {
    "food_dining":     "restaurants, cafes, food delivery, coffee shops (Zomato, Swiggy, McDonald's, Third Wave Coffee, Dineout)",
    "groceries":       "supermarkets, grocery stores, kirana shops (DMart, BigBasket, Blinkit, Zepto, Loyal World)",
    "transport":       "cab rides, auto, metro (Uber, Ola, Rapido)",
    "fuel":            "petrol/diesel stations only (BPCL, HPCL, Indian Oil, Bharat Petroleum)",
    "utilities":       "electricity, water, gas bills (BESCOM, MSEDCL, Tata Power)",
    "mobile_internet": "mobile recharge, postpaid, broadband (Airtel, Jio, Vi, BSNL)",
    "insurance":       "insurance premiums (LIC, HDFC Life, Star Health, PolicyBazaar)",
    "shopping":        "retail, online shopping, clothing (Amazon, Flipkart, Decathlon, Myntra, Zudio, Max)",
    "health_medical":  "hospitals, clinics, pharmacies, vets (Apollo, MedPlus, 1mg)",
    "travel_hotels":   "hotels, flights, trains (MakeMyTrip, IRCTC, Lemon Tree)",
    "entertainment":   "movies, streaming, events (Netflix, BookMyShow, PVR)",
    "education":       "school fees, online courses (Udemy, Coursera, tuition)",
    "tax":             "income tax, GST (CBDT, TDS)",
    "rent":            "house or PG rent payments",
    "other":           "anything that doesn't fit other categories",
    "atm_withdrawal":  "ATM cash withdrawal (starts with ATW)",
    "salary":          "monthly salary or payroll",
    "dividend":        "dividend from stocks or mutual funds",
    "interest_earned": "interest from savings account or FD",
    "other_income":    "any other income",
    "investment_out":  "money sent to invest (Zerodha, Groww, mutual fund purchase)",
    "investment_in":   "money received from selling investments",
    "lending_out":     "money lent to someone",
    "lending_in":      "money returned by someone",
    "cc_payment":      "credit card bill payment",
    "self_transfer":   "transfer between your own accounts",
    "returns":         "refund or reversal",
}

>>>>>>> Stashed changes

def _keyword_match(description: str, candidate_slugs: list[str]) -> str | None:
    """
    Fast deterministic match — only returns a slug if it's in candidate_slugs.
    This ensures we never assign an income label to an expense transaction etc.
    """
    logger.info("KEYWORD_MATCH called: desc='%s' candidates=%s", description[:40], candidate_slugs)
    desc_upper = description.upper()
    for keywords, slug in KEYWORD_RULES:
        if any(kw in desc_upper for kw in keywords):
            if slug in candidate_slugs:
                return slug
            # slug matched but wrong nature — don't fall through to Ollama with it
            # just return None and let Ollama try with the correct candidate list
            return None
    return None


def categorize(description: str, candidate_slugs: list[str]) -> tuple[str, float]:
    """
    Categorize a transaction description against a set of candidate slugs.
    Tries keyword rules first, then Ollama.
    Returns (slug, confidence).
    """
    if not candidate_slugs:
        return "", 0.0

    # fast path — keyword rules
    keyword_slug = _keyword_match(description, candidate_slugs)
    if keyword_slug:
        logger.debug("Keyword match: '%s' → %s", description[:50], keyword_slug)
        return keyword_slug, 0.95

    # slow path — Ollama
    return _ollama_categorize(description, candidate_slugs)


def _ollama_categorize(description: str, candidate_slugs: list[str]) -> tuple[str, float]:
    slugs_formatted = "\n".join(f"- {s}" for s in candidate_slugs)

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
                "options": {"temperature": 0.0, "num_predict": 20},
            },
            timeout=30.0,
        )
        response.raise_for_status()
        raw = response.json().get("response", "").strip().lower()
        raw = raw.split("\n")[0].strip().strip("\"'.,;:")

        for slug in candidate_slugs:
            if slug in raw:
                logger.debug("Ollama match: '%s' → %s", description[:50], slug)
                return slug, 0.75

        logger.warning("Ollama could not categorize: '%s' (raw: %s)",
                        description[:50], raw[:40])
        return candidate_slugs[0] if candidate_slugs else "", 0.0

    except httpx.TimeoutException:
        logger.warning("Ollama timeout for: %s", description[:60])
        return "", 0.0
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        return "", 0.0