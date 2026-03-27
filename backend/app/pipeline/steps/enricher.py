"""
pipeline/steps/enricher.py

Reads ctx.raw_transactions, applies enrichment, writes to ctx.transactions.

Financial nature auto-assignment rules (in order, first match wins):
  transfer   — CC payments, refunds, reversals, internal moves
  investment — Zerodha, NSE, MF flows
  income     — salary, ACH credits, interest
  expense    — everything else that's a debit
  lending    — must be set manually in Reconcile UI
  unknown    — fallback when nothing matches cleanly
"""

from app.pipeline.steps.base import PipelineStep
from app.pipeline.context import PipelineContext


NATURE_RULES: list[tuple[list[str], str]] = [
    # transfer — internal moves, CC payments, refunds, reversals
    (["CC PAYMENT", "CREDIT CARD PAYMENT", "BPPY", "BILLDESK CC",
      "MYCARDS CC BILL PAY", "IB BILLPAY DR", "CC BILL PAY",
      "NEFT-", "IMPS-", "FT- ", "UPI-SELF", "SELF TRANSFER",
      "SWEEP-IN", "INT. ON SWCR", "TPT-MONEY RETURN",
      "50100192453731-TPT",
      # refunds and reversals
      "REFUND", "REVERSAL", "CHARGEBACK", "RETURN CR",
      "FAILED TXN", "TXN FAILED", "DISPUTE CR"], "transfer"),

    # investment — Zerodha, NSE, MF
    (["ZERODHA", "GROWW", "KUVERA", "COIN BY ZERODHA", "SMALLCASE",
      "MUTUAL FUND", "MF-", "SIP-", "NSDL", "CDSL",
      "NSE CLEARING", "BSE CLEARING",
      "ACH D- INDIAN CLEARING CORP", "ACH D- ZERODHA",
      "INDIAN CLEARING CORP"], "investment"),

    # income — salary, ACH credits, interest
    (["SALARY", "PAYROLL", "DIVIDEND", "INTEREST CREDIT",
      "INTEREST EARNED", "ACH C- "], "income"),

    # expense — known merchant keywords
    (["PZELECTRICITY", "ELECTRICITY", "BESCOM", "MSEDCL",
      "PZPOSTPAID", "PZRECHARGE", "AIRTEL", "JIOFIBER",
      "PZINSURANCE", "INSURANCE", "LIC ",
      "BPCL", "HPCL", "IOCL", "INDIAN OIL", "PETROL",
      "CBDT", "INCOME TAX",
      "ZOMATO", "SWIGGY", "MCDONALDS", "MC DONALDS",
      "AMAZON", "FLIPKART", "DECATHLON",
      "AVENUE SUPERMARTS", "DMART", "BIGBASKET",
      "HOTEL", "IRCTC", "MAKEMYTRIP",
      "RENT", "HOUSE RENT"], "expense"),
]

# credits that are transfers not income
CREDIT_TRANSFER_SIGNALS = [
    "NSE CLEARING", "INDIAN CLEARING CORP", "ZERODHA",
    "SWEEP-IN", "FT- ", "IMPS-", "NEFT-",
    "TPT-MONEY RETURN", "ACH C- INDIAN CLEARING",
    "REFUND", "REVERSAL", "RETURN CR",
]


def _assign_nature(description: str, transaction_type: str) -> str:
    desc_upper = description.upper()

    for keywords, nature in NATURE_RULES:
        if any(kw in desc_upper for kw in keywords):
            return nature

    # fallback by direction
    if transaction_type == "credit":
        if any(kw in desc_upper for kw in CREDIT_TRANSFER_SIGNALS):
            return "transfer"
        return "income"
    else:
        return "expense"


class EnricherStep(PipelineStep):

    def run(self, ctx: PipelineContext) -> None:
        if not ctx.raw_transactions:
            ctx.add_error("Enricher received no raw transactions to process.")
            return

        self.logger.info(
            "Enriching %d raw transactions for job %s",
            len(ctx.raw_transactions), ctx.job_id
        )

        seen: set[tuple] = set()
        transactions = []

        for raw in ctx.raw_transactions:
            key = (raw.date, raw.amount, raw.description.strip().lower())
            is_duplicate = key in seen
            if not is_duplicate:
                seen.add(key)

            desc_upper = raw.description.upper()
            is_return = (
                raw.transaction_type == "credit"
                and any(kw in desc_upper for kw in (
                    "REVERSAL", "REFUND", "CHARGEBACK", "DISPUTE", "CANCELLED"
                ))
            )

            nature = _assign_nature(raw.description, raw.transaction_type)

            transactions.append({
                "upload_job_id":      ctx.job_id,
                "date":               raw.date,
                "description_raw":    raw.description,
                "description":        raw.description,
                "amount":             raw.amount,
                "currency":           raw.currency,
                "transaction_type":   raw.transaction_type,
                "balance":            raw.balance,
                "bank":               ctx.bank,
                "account_type":       ctx.account_type,
                "account_nickname":   ctx.account_nickname,
                "is_duplicate":       is_duplicate,
                "is_return":          is_return,
                "financial_nature":   nature,
                "transfer_pair_id":   None,
                "transfer_confirmed": False,
                "label_id":           None,
                "category_confidence": None,
                "review_status":      "pending",
            })

        ctx.transactions = transactions

        dup_count = sum(1 for t in transactions if t["is_duplicate"])
        ret_count = sum(1 for t in transactions if t["is_return"])
        nature_counts = {}
        for t in transactions:
            n = t["financial_nature"]
            nature_counts[n] = nature_counts.get(n, 0) + 1

        self.logger.info(
            "Enrichment done — %d transactions, %d duplicates, %d returns | %s",
            len(transactions), dup_count, ret_count,
            ", ".join(f"{k}={v}" for k, v in sorted(nature_counts.items()))
        )