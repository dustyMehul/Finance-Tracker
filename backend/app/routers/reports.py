"""
routers/reports.py

Reporting rules:
  expense    debit  → spend
  income     credit → income
  investment debit  → spend  (cash left account)
  investment credit → income (cash returned)
  transfer          → excluded
  lending           → excluded (lending tracker only)
  unknown           → excluded (shown as warning count)

Net = (income + investment_credit) − (expense + investment_debit)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional
from dateutil.relativedelta import relativedelta

from app.db.database import get_db
from app.db.models import Transaction, ReviewStatus, FinancialNature, TransactionType
from app.core.logging import get_logger

router = APIRouter(prefix="/reports", tags=["reports"])
logger = get_logger(__name__)

REPORTABLE = [ReviewStatus.approved, ReviewStatus.edited, ReviewStatus.finalized]
SPEND_NATURES  = [FinancialNature.expense, FinancialNature.investment]
INCOME_NATURES = [FinancialNature.income,  FinancialNature.investment]


def _date_range(period: str, date_from: Optional[str], date_to: Optional[str]):
    today = date.today()
    if date_from and date_to:
        return date.fromisoformat(date_from), date.fromisoformat(date_to)
    if period == "current_month":
        return today.replace(day=1), today
    elif period == "last_month":
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        return first, today.replace(day=1) - timedelta(days=1)
    elif period == "last_30":
        return today - timedelta(days=30), today
    elif period == "last_90":
        return today - timedelta(days=90), today
    elif period == "last_180":
        return today - timedelta(days=180), today
    elif period == "current_fy":
        # Indian FY: April 1 to March 31
        fy_start_year = today.year if today.month >= 4 else today.year - 1
        return date(fy_start_year, 4, 1), today
    elif period == "all":
        return date(2000, 1, 1), today
    else:
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        return first, today.replace(day=1) - timedelta(days=1)


def _period_label(period: str, d_from: date, d_to: date) -> str:
    """Human-readable label for the selected period."""
    if period == "current_month":
        return d_from.strftime("%B %Y")
    elif period == "last_month":
        return d_from.strftime("%B %Y")
    elif period == "last_30":
        return "Last 30 days"
    elif period == "last_90":
        return "Last 3 months"
    elif period == "last_180":
        return "Last 6 months"
    elif period == "current_fy":
        return f"Current FY ({d_from.strftime('%b %Y')} – {d_to.strftime('%b %Y')})"
    elif period == "all":
        return "All time"
    else:
        return f"{d_from.strftime('%b %Y')} – {d_to.strftime('%b %Y')}"


def _base(db, d_from, d_to):
    return db.query(Transaction).filter(
        Transaction.review_status.in_(REPORTABLE),
        Transaction.date >= d_from,
        Transaction.date <= d_to,
    )


def _is_spend(t):
    """True if this transaction reduces available cash."""
    if t.financial_nature == FinancialNature.expense:
        return True
    if t.financial_nature == FinancialNature.investment and \
       t.transaction_type == TransactionType.debit:
        return True
    return False


def _is_income(t):
    """True if this transaction increases available cash."""
    if t.financial_nature == FinancialNature.income:
        return True
    if t.financial_nature == FinancialNature.investment and \
       t.transaction_type == TransactionType.credit:
        return True
    return False


@router.get("/summary")
def get_summary(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = _base(db, d_from, d_to).all()

    # cash inflow = income + investment withdrawals (investment credits)
    income_txns      = [t for t in txns if t.financial_nature == FinancialNature.income]
    inv_withdraw     = [t for t in txns if t.financial_nature == FinancialNature.investment
                        and t.transaction_type == TransactionType.credit]

    # expenses = expense nature only
    expense_txns     = [t for t in txns if t.financial_nature == FinancialNature.expense]

    # investments = investment debits (money going out to invest)
    inv_out_txns     = [t for t in txns if t.financial_nature == FinancialNature.investment
                        and t.transaction_type == TransactionType.debit]

    # lending
    lending_out      = [t for t in txns if t.financial_nature == FinancialNature.lending
                        and t.transaction_type == TransactionType.debit]
    lending_in       = [t for t in txns if t.financial_nature == FinancialNature.lending
                        and t.transaction_type == TransactionType.credit]

    unknown_txns     = [t for t in txns if t.financial_nature == FinancialNature.unknown]

    total_inflow     = sum(t.amount for t in income_txns) + sum(t.amount for t in inv_withdraw)
    total_expenses   = sum(t.amount for t in expense_txns)
    total_invested   = sum(t.amount for t in inv_out_txns)

    # liquidity = actual cash left: inflow - expenses - investments
    liquidity        = total_inflow - total_expenses - total_invested

    return {
        "period":           {"from": str(d_from), "to": str(d_to)},
        "period_label":     _period_label(period, d_from, d_to),
        # 4 card values
        "cash_inflow":      round(total_inflow, 2),
        "cash_inflow_count": len(income_txns) + len(inv_withdraw),
        "total_expenses":   round(total_expenses, 2),
        "expense_count":    len(expense_txns),
        "total_invested":   round(total_invested, 2),
        "invested_count":   len(inv_out_txns),
        "liquidity":        round(liquidity, 2),
        # extras
        "unknown_count":    len(unknown_txns),
        # investment breakdown
        "investment_out":   round(total_invested, 2),
        "investment_in":    round(sum(t.amount for t in inv_withdraw), 2),
        # lending breakdown
        "lending_out":      round(sum(t.amount for t in lending_out), 2),
        "lending_in":       round(sum(t.amount for t in lending_in), 2),
        "lending_outstanding": round(
            sum(t.amount for t in lending_out) - sum(t.amount for t in lending_in), 2
        ),
    }


@router.get("/categories")
def get_categories(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    account_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = _base(db, d_from, d_to).all()
    # categories only shows expense nature — investment excluded intentionally
    spend_txns = [t for t in txns if t.financial_nature == FinancialNature.expense]
    if account_type:
        spend_txns = [t for t in spend_txns if t.account_type and t.account_type.value == account_type]

    buckets: dict = {}
    total = sum(t.amount for t in spend_txns)

    for t in spend_txns:
        lid        = t.label_id or "__none__"
        label_name = t.label.name  if t.label else "Uncategorized"
        color      = t.label.color if t.label else "#D3D1C7"

        if lid not in buckets:
            buckets[lid] = {"label_id": t.label_id, "label_name": label_name,
                            "color": color, "amount": 0.0, "count": 0, "percentage": 0.0}
        buckets[lid]["amount"] += t.amount
        buckets[lid]["count"]  += 1

    result = []
    for b in buckets.values():
        b["amount"]     = round(b["amount"], 2)
        b["percentage"] = round(b["amount"] / total * 100, 1) if total > 0 else 0
        result.append(b)

    result.sort(key=lambda x: x["amount"], reverse=True)
    return {"period": {"from": str(d_from), "to": str(d_to)},
            "categories": result, "total": round(total, 2)}


@router.get("/monthly")
def get_monthly(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if period in ("last_month", "current_month", "last_30"):
        d_from = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1)
        d_from = d_from - relativedelta(months=5)
        d_to   = date.today()
    else:
        d_from, d_to = _date_range(period, date_from, date_to)

    txns = _base(db, d_from, d_to).all()
    months: dict = {}

    for t in txns:
        key = t.date.strftime("%Y-%m")
        if key not in months:
            months[key] = {"month": key, "spend": 0.0, "income": 0.0, "count": 0}
        if _is_spend(t):
            months[key]["spend"] += t.amount
        elif _is_income(t):
            months[key]["income"] += t.amount
        months[key]["count"] += 1

    result = sorted(months.values(), key=lambda x: x["month"])
    for m in result:
        m["spend"]  = round(m["spend"], 2)
        m["income"] = round(m["income"], 2)

    return {"months": result}


@router.get("/merchants")
def get_merchants(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(15, le=50),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = _base(db, d_from, d_to).all()
    spend_txns = [t for t in txns if _is_spend(t)]

    merchants: dict = {}
    for t in spend_txns:
        name = (t.description or t.description_raw or "Unknown")[:40].strip()
        if name not in merchants:
            merchants[name] = {"name": name, "amount": 0.0, "count": 0}
        merchants[name]["amount"] += t.amount
        merchants[name]["count"]  += 1

    result = sorted(merchants.values(), key=lambda x: x["amount"], reverse=True)[:limit]
    for m in result:
        m["amount"] = round(m["amount"], 2)
    return {"period": {"from": str(d_from), "to": str(d_to)}, "merchants": result}


@router.get("/trend")
def get_trend(
    view: str = Query("monthly"),  # "monthly" or "annual"
    db: Session = Depends(get_db),
):
    """
    Trend data — immune to period dropdown, has its own view toggle.
    monthly: last 6 months including current month
    annual:  last 5 financial years (Apr-Mar)
    """
    today = date.today()

    if view == "monthly":
        # build list of last 6 months including current
        months = []
        for i in range(5, -1, -1):
            d = today.replace(day=1) - relativedelta(months=i)
            months.append(d.strftime("%Y-%m"))

        txns = _base(db, date.fromisoformat(months[0] + "-01"), today).all()

        # bucket by month
        buckets: dict[str, dict] = {m: {"key": m, "spend": 0.0, "income": 0.0, "has_data": False} for m in months}
        for t in txns:
            key = t.date.strftime("%Y-%m")
            if key in buckets:
                if t.financial_nature == FinancialNature.expense:
                    buckets[key]["spend"] += t.amount
                    buckets[key]["has_data"] = True
                elif t.financial_nature == FinancialNature.income:
                    buckets[key]["income"] += t.amount
                    buckets[key]["has_data"] = True

        result = []
        for m in months:
            b = buckets[m]
            d = date.fromisoformat(b["key"] + "-01")
            result.append({
                "key":      b["key"],
                "label":    d.strftime("%b"),
                "spend":    round(b["spend"], 2),
                "income":   round(b["income"], 2),
                "has_data": b["has_data"],
            })

        # find first and last month with actual data
        # trim empty slots from edges only — keep gaps in the middle
        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)

        if first_data is not None and last_data is not None:
            last_idx = len(result) - last_data
            result = result[first_data:last_idx]

        return {"view": "monthly", "items": result}

    else:  # annual
        # last 5 FYs
        current_fy_start = today.year if today.month >= 4 else today.year - 1
        fy_list = list(range(current_fy_start - 4, current_fy_start + 1))

        d_from = date(fy_list[0], 4, 1)
        txns = _base(db, d_from, today).all()

        buckets: dict[int, dict] = {
            y: {"fy_start": y, "spend": 0.0, "income": 0.0, "has_data": False}
            for y in fy_list
        }

        for t in txns:
            fy = t.date.year if t.date.month >= 4 else t.date.year - 1
            if fy in buckets:
                if t.financial_nature == FinancialNature.expense:
                    buckets[fy]["spend"] += t.amount
                    buckets[fy]["has_data"] = True
                elif t.financial_nature == FinancialNature.income:
                    buckets[fy]["income"] += t.amount
                    buckets[fy]["has_data"] = True

        result = []
        for y in fy_list:
            b = buckets[y]
            result.append({
                "key":      str(y),
                "label":    f"FY{str(y+1)[-2:]}",
                "spend":    round(b["spend"], 2),
                "income":   round(b["income"], 2),
                "has_data": b["has_data"],
            })

        # trim empty edges
        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            last_idx = len(result) - last_data
            result = result[first_data:last_idx]

        return {"view": "annual", "items": result}


EXPENSE_TRACKED_SLUGS = [
    "entertainment", "food_dining", "fuel", "groceries",
    "shopping", "subscription", "transport", "travel_hotels",
]


@router.get("/expense-trend")
def get_expense_trend(
    view: str = Query("monthly"),
    account_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Expense trend — immune to period dropdown.
    monthly: last 6 months including current
    annual:  last 5 financial years (Apr–Mar)
    Returns total spend + per-tracked-category breakdown per period.
    """
    from app.db.models import Label

    today = date.today()

    # build slug → display info map for tracked slugs
    labels = db.query(Label).filter(Label.nature == FinancialNature.expense.value).all()
    slug_info = {l.slug: {"name": l.name, "color": l.color} for l in labels}

    if view == "monthly":
        months = []
        for i in range(5, -1, -1):
            d = today.replace(day=1) - relativedelta(months=i)
            months.append(d.strftime("%Y-%m"))

        q = _base(db, date.fromisoformat(months[0] + "-01"), today).filter(
            Transaction.financial_nature == FinancialNature.expense
        )
        if account_type:
            q = q.filter(Transaction.account_type == account_type)
        txns = q.all()

        buckets: dict = {
            m: {"key": m, "spend": 0.0, "has_data": False,
                **{s: 0.0 for s in EXPENSE_TRACKED_SLUGS}}
            for m in months
        }

        for t in txns:
            key = t.date.strftime("%Y-%m")
            if key in buckets:
                buckets[key]["spend"] += t.amount
                buckets[key]["has_data"] = True
                if t.label and t.label.slug in EXPENSE_TRACKED_SLUGS:
                    buckets[key][t.label.slug] += t.amount

        result = []
        for m in months:
            b = buckets[m]
            d = date.fromisoformat(b["key"] + "-01")
            result.append({
                "key":        b["key"],
                "label":      d.strftime("%b"),
                "spend":      round(b["spend"], 2),
                "has_data":   b["has_data"],
                "categories": {s: round(b[s], 2) for s in EXPENSE_TRACKED_SLUGS},
            })

        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            result = result[first_data: len(result) - last_data]

        return {"view": "monthly", "items": result,
                "tracked": EXPENSE_TRACKED_SLUGS, "slug_info": slug_info}

    else:  # annual
        current_fy_start = today.year if today.month >= 4 else today.year - 1
        fy_list = list(range(current_fy_start - 4, current_fy_start + 1))

        q = _base(db, date(fy_list[0], 4, 1), today).filter(
            Transaction.financial_nature == FinancialNature.expense
        )
        if account_type:
            q = q.filter(Transaction.account_type == account_type)
        txns = q.all()

        buckets = {
            y: {"fy_start": y, "spend": 0.0, "has_data": False,
                **{s: 0.0 for s in EXPENSE_TRACKED_SLUGS}}
            for y in fy_list
        }

        for t in txns:
            fy = t.date.year if t.date.month >= 4 else t.date.year - 1
            if fy in buckets:
                buckets[fy]["spend"] += t.amount
                buckets[fy]["has_data"] = True
                if t.label and t.label.slug in EXPENSE_TRACKED_SLUGS:
                    buckets[fy][t.label.slug] += t.amount

        result = []
        for y in fy_list:
            b = buckets[y]
            result.append({
                "key":        str(y),
                "label":      f"FY{str(y + 1)[-2:]}",
                "spend":      round(b["spend"], 2),
                "has_data":   b["has_data"],
                "categories": {s: round(b[s], 2) for s in EXPENSE_TRACKED_SLUGS},
            })

        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            result = result[first_data: len(result) - last_data]

        return {"view": "annual", "items": result,
                "tracked": EXPENSE_TRACKED_SLUGS, "slug_info": slug_info}


@router.get("/investment-trend")
def get_investment_trend(
    view: str = Query("monthly"),
    db: Session = Depends(get_db),
):
    """
    Diverging investment trend — immune to period dropdown.
    invested_out: investment debits (positive) — money going into investments
    withdrawn:    investment credits (negative) — money coming back
    """
    today = date.today()

    if view == "monthly":
        months = []
        for i in range(5, -1, -1):
            d = today.replace(day=1) - relativedelta(months=i)
            months.append(d.strftime("%Y-%m"))

        txns = _base(db, date.fromisoformat(months[0] + "-01"), today).filter(
            Transaction.financial_nature == FinancialNature.investment
        ).all()

        buckets: dict = {
            m: {"key": m, "invested_out": 0.0, "withdrawn": 0.0, "has_data": False}
            for m in months
        }

        for t in txns:
            key = t.date.strftime("%Y-%m")
            if key in buckets:
                buckets[key]["has_data"] = True
                if t.transaction_type == TransactionType.debit:
                    buckets[key]["invested_out"] += t.amount
                else:
                    buckets[key]["withdrawn"] += t.amount

        result = []
        for m in months:
            b = buckets[m]
            d = date.fromisoformat(b["key"] + "-01")
            result.append({
                "key":          b["key"],
                "label":        d.strftime("%b"),
                "invested_out": round(b["invested_out"], 2),
                "withdrawn":    round(b["withdrawn"], 2),
                "has_data":     b["has_data"],
            })

        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            result = result[first_data: len(result) - last_data]

        return {"view": "monthly", "items": result}

    else:  # annual
        current_fy_start = today.year if today.month >= 4 else today.year - 1
        fy_list = list(range(current_fy_start - 4, current_fy_start + 1))

        txns = _base(db, date(fy_list[0], 4, 1), today).filter(
            Transaction.financial_nature == FinancialNature.investment
        ).all()

        buckets = {
            y: {"fy_start": y, "invested_out": 0.0, "withdrawn": 0.0, "has_data": False}
            for y in fy_list
        }

        for t in txns:
            fy = t.date.year if t.date.month >= 4 else t.date.year - 1
            if fy in buckets:
                buckets[fy]["has_data"] = True
                if t.transaction_type == TransactionType.debit:
                    buckets[fy]["invested_out"] += t.amount
                else:
                    buckets[fy]["withdrawn"] += t.amount

        result = []
        for y in fy_list:
            b = buckets[y]
            result.append({
                "key":          str(y),
                "label":        f"FY{str(y + 1)[-2:]}",
                "invested_out": round(b["invested_out"], 2),
                "withdrawn":    round(b["withdrawn"], 2),
                "has_data":     b["has_data"],
            })

        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            result = result[first_data: len(result) - last_data]

        return {"view": "annual", "items": result}


@router.get("/lending-trend")
def get_lending_trend(
    view: str = Query("monthly"),
    db: Session = Depends(get_db),
):
    today = date.today()

    if view == "monthly":
        months = []
        for i in range(5, -1, -1):
            d = today.replace(day=1) - relativedelta(months=i)
            months.append(d.strftime("%Y-%m"))

        txns = _base(db, date.fromisoformat(months[0] + "-01"), today).filter(
            Transaction.financial_nature == FinancialNature.lending
        ).all()

        buckets: dict = {
            m: {"key": m, "lent_out": 0.0, "returned": 0.0, "has_data": False}
            for m in months
        }

        for t in txns:
            key = t.date.strftime("%Y-%m")
            if key in buckets:
                buckets[key]["has_data"] = True
                if t.transaction_type == TransactionType.debit:
                    buckets[key]["lent_out"] += t.amount
                else:
                    buckets[key]["returned"] += t.amount

        result = []
        for m in months:
            b = buckets[m]
            d = date.fromisoformat(b["key"] + "-01")
            result.append({
                "key":      b["key"],
                "label":    d.strftime("%b"),
                "lent_out": round(b["lent_out"], 2),
                "returned": round(b["returned"], 2),
                "has_data": b["has_data"],
            })

        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            result = result[first_data: len(result) - last_data]

        return {"view": "monthly", "items": result}

    else:  # annual
        current_fy_start = today.year if today.month >= 4 else today.year - 1
        fy_list = list(range(current_fy_start - 4, current_fy_start + 1))

        txns = _base(db, date(fy_list[0], 4, 1), today).filter(
            Transaction.financial_nature == FinancialNature.lending
        ).all()

        buckets = {
            y: {"fy_start": y, "lent_out": 0.0, "returned": 0.0, "has_data": False}
            for y in fy_list
        }

        for t in txns:
            fy = t.date.year if t.date.month >= 4 else t.date.year - 1
            if fy in buckets:
                buckets[fy]["has_data"] = True
                if t.transaction_type == TransactionType.debit:
                    buckets[fy]["lent_out"] += t.amount
                else:
                    buckets[fy]["returned"] += t.amount

        result = []
        for y in fy_list:
            b = buckets[y]
            result.append({
                "key":      str(y),
                "label":    f"FY{str(y + 1)[-2:]}",
                "lent_out": round(b["lent_out"], 2),
                "returned": round(b["returned"], 2),
                "has_data": b["has_data"],
            })

        first_data = next((i for i, r in enumerate(result) if r["has_data"]), None)
        last_data  = next((i for i, r in enumerate(reversed(result)) if r["has_data"]), None)
        if first_data is not None and last_data is not None:
            result = result[first_data: len(result) - last_data]

        return {"view": "annual", "items": result}


@router.get("/lending")
def get_lending(
    period: str = Query("all"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = _base(db, d_from, d_to).filter(
        Transaction.financial_nature == FinancialNature.lending
    ).all()

    lent     = [t for t in txns if t.transaction_type == TransactionType.debit]
    returned = [t for t in txns if t.transaction_type == TransactionType.credit]

    return {
        "total_lent":     round(sum(t.amount for t in lent), 2),
        "total_returned": round(sum(t.amount for t in returned), 2),
        "outstanding":    round(sum(t.amount for t in lent) - sum(t.amount for t in returned), 2),
        "transactions": [
            {"id": t.id, "date": str(t.date), "description": t.description,
             "amount": t.amount, "direction": t.transaction_type, "note": t.user_note}
            for t in sorted(txns, key=lambda x: x.date, reverse=True)
        ],
    }