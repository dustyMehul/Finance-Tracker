"""
ai/ollama_client.py

Keyword rules + Ollama fallback for transaction categorization.

Flow:
  1. _keyword_match — fast, deterministic, covers known Indian merchants
  2. _ollama_categorize — fallback for unknown merchants
     Uses few-shot examples + JSON output for reliable parsing
     Model: configured via OLLAMA_MODEL in .env (recommend: qwen2.5:7b)
"""

import httpx
import json
import re
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Keyword rules — first match wins
# Slugs must match seed_labels.py exactly
# ---------------------------------------------------------------------------

KEYWORD_RULES: list[tuple[list[str], str]] = [
    (["PZELECTRICITY", "ELECTRICITY", "BESCOM", "MSEDCL",
      "TPDDL", "BSES", "TORRENT POWER"], "utilities"),
    (["PZPOSTPAID", "PZRECHARGE", "AIRTEL", "JIOFIBER", "BSNL",
      "VODAFONE", "VI ", "RECHARGE NON BBPS", "RECHARGE"], "mobile_internet"),
    (["PZINSURANCE", "INSURANCE", "LIC ", "LIC BILLDESK",
      "HDFC LIFE", "ICICI PRU", "SBI LIFE",
      "STAR HEALTH", "TATA AIG", "POLICYBAZAAR"], "insurance"),
    (["BPCL", "HPCL", "IOCL", "INDIAN OIL", "PETROL",
      "BHARAT PETROLEUM", "NAYARA", "ESSAR OIL"], "fuel"),
    (["CBDT", "INCOME TAX", "GST PAYMENT", "TDS PAYMENT"], "tax"),
    (["AVENUE SUPERMARTS", "DMART", "BIGBASKET", "GROFERS",
      "BLINKIT", "ZEPTO", "SWIGGY INSTAMART",
      "KIRANA", "GROCER", "LOYAL WORLD"], "groceries"),
    (["MCDONALDS", "MC DONALDS", "ZOMATO", "SWIGGY", "DOMINOS",
      "PIZZA", "CAFE", "RESTAURANT", "DINING", "BISTRO",
      "SARJAPU", "SCOTCH YARD", "HORTICULTU",
      "RAW FOODS", "BHARATPE", "THIRD WAVE",
      "STARBUCKS", "CHAI", "COFFEE", "BAKERY",
      "VAAYU FOODS", "FOOD", "DINEOUT"], "food_dining"),
    (["LEMON TREE", "HOTEL", "MAKEMYTRIP", "IRCTC", "CLEARTRIP",
      "GOIBIBO", "OYO", "AIRLINES", "INDIGO",
      "SPICEJET", "ACH C- INDIAN RAILWAY"], "travel_hotels"),
    (["DECATHLON", "AMAZON", "FLIPKART", "MYNTRA", "AJIO",
      "NYKAA", "GYFTR", "SMARTBUY", "CAMPUS ACTIVEWEAR",
      "MAX RETAIL", "ZUDIO", "ALL SAINTS",
      "PIXEL MOTORS", "BEARDO"], "shopping"),
    (["PHARMACY", "HOSPITAL", "CLINIC", "APOLLO", "MEDPLUS",
      "NETMEDS", "1MG", "PRACTO", "VETS", "VETERINARY"], "health_medical"),
    (["UBER", "OLA", "RAPIDO", "METRO", "NAMMA", "AUTO"], "transport"),
    (["HOUSE RENT", "HRA ", "RENT PAYMENT"], "rent"),
    (["SCHOOL FEE", "COLLEGE FEE", "TUITION", "UDEMY",
      "COURSERA", "UNACADEMY"], "education"),
    (["NETFLIX", "HOTSTAR", "PRIME VIDEO", "SPOTIFY",
      "BOOKMYSHOW", "PVR", "INOX"], "entertainment"),
    (["ZERODHA", "GROWW", "KUVERA", "SMALLCASE",
      "NSE CLEARING", "BSE CLEARING", "INDIAN CLEARING CORP",
      "ACH D- ZERODHA", "ACH D- INDIAN CLEARING",
      "NSDL", "CDSL", "MUTUAL FUND", "MF-", "SIP-"], "investment_out"),
    (["SALARY", "PAYROLL", "STIPEND"], "salary"),
    (["DIVIDEND", "DIV CREDIT"], "dividend"),
    (["INTEREST CREDIT", "INTEREST EARNED",
      "INT. ON SWCR", "SWEEP-IN"], "interest_earned"),
]

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


def _keyword_match(description: str, candidate_slugs: list[str]) -> str | None:
    """Fast deterministic match. Only returns slug if it's in candidate_slugs."""
    logger.info("KEYWORD_MATCH called: desc='%s' candidates=%s",
                description[:40], candidate_slugs)
    desc_upper = description.upper()
    for keywords, slug in KEYWORD_RULES:
        if any(kw in desc_upper for kw in keywords):
            if slug in candidate_slugs:
                return slug
            return None
    return None


def categorize(description: str, candidate_slugs: list[str]) -> tuple[str, float]:
    """Keyword rules first, then Ollama."""
    if not candidate_slugs:
        return "", 0.0
    keyword_slug = _keyword_match(description, candidate_slugs)
    if keyword_slug:
        logger.debug("Keyword match: '%s' → %s", description[:50], keyword_slug)
        return keyword_slug, 0.95
    return _ollama_categorize(description, candidate_slugs)


def _ollama_categorize(description: str, candidate_slugs: list[str]) -> tuple[str, float]:
    """
    Call Ollama with few-shot examples + JSON output for reliable parsing.
    Few-shot examples show the model exactly what format and reasoning is expected.
    JSON output prevents the model adding explanation text around the answer.
    """
    slugs_formatted = "\n".join(
        f'  "{s}": "{SLUG_DESCRIPTIONS.get(s, s)}"'
        for s in candidate_slugs
    )

    prompt = f"""You are categorizing Indian bank transaction descriptions.
Return ONLY a JSON object like {{"slug": "category_slug"}} — nothing else, no explanation.

Examples:
{{"description": "ZOMATO ORDER BENGALURU", "slug": "food_dining"}}
{{"description": "BPCL FUEL STATION MUMBAI", "slug": "fuel"}}
{{"description": "HDFC LIFE INSURANCE PREMIUM", "slug": "insurance"}}
{{"description": "CBDT TDS PAYMENT GURGAON", "slug": "tax"}}
{{"description": "AMAZON RETAIL INDIA PVT LTD", "slug": "shopping"}}
{{"description": "MAKEMYTRIP INDIA FLIGHTS", "slug": "travel_hotels"}}
{{"description": "AVENUE SUPERMARTS DMART KOTA", "slug": "groceries"}}
{{"description": "AIRTEL POSTPAID BILL PAYMENT", "slug": "mobile_internet"}}
{{"description": "NEXT DOOR VETS BANGALORE", "slug": "health_medical"}}
{{"description": "SRI GAYATHRI ENTERPRISES KOTA", "slug": "other"}}

Now categorize:
{{"description": "{description}", "slug": ?}}

Valid slugs:
{slugs_formatted}

JSON response:"""

    try:
        response = httpx.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 30},
            },
            timeout=30.0,
        )
        response.raise_for_status()
        raw = response.json().get("response", "").strip()

        # try JSON parse first
        match = re.search(r'\{[^}]+\}', raw)
        if match:
            try:
                parsed = json.loads(match.group())
                slug = parsed.get("slug", "").strip().lower().strip("\"' ")
                if slug in candidate_slugs:
                    logger.debug("Ollama JSON: '%s' → %s", description[:50], slug)
                    return slug, 0.75
            except json.JSONDecodeError:
                pass

        # fallback: scan for quoted slug
        raw_lower = raw.lower()
        for slug in candidate_slugs:
            if f'"{slug}"' in raw_lower or f"'{slug}'" in raw_lower:
                logger.debug("Ollama quoted: '%s' → %s", description[:50], slug)
                return slug, 0.70

        # last resort: substring match
        for slug in candidate_slugs:
            if slug in raw_lower:
                logger.debug("Ollama substring: '%s' → %s", description[:50], slug)
                return slug, 0.65

        logger.warning("Ollama no match: '%s' (raw='%s')", description[:50], raw[:60])
        return "", 0.0

    except httpx.TimeoutException:
        logger.warning("Ollama timeout for: %s", description[:60])
        return "", 0.0
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        return "", 0.0