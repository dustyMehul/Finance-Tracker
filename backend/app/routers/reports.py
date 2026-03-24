"""
routers/reports.py

GET /reports/summary     — total spend, income, net, transaction count
GET /reports/categories  — spend grouped by label
GET /reports/monthly     — spend + income grouped by month
GET /reports/merchants   — top merchants by total spend
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date, datetime, timedelta
from typing import Optional
from dateutil.relativedelta import relativedelta

from app.db.database import get_db
from app.db.models import Transaction, Label, ReviewStatus, TransactionType
from app.core.logging import get_logger

router = APIRouter(prefix="/reports", tags=["reports"])
logger = get_logger(__name__)

REPORTABLE = [
    ReviewStatus.approved,
    ReviewStatus.edited,
    ReviewStatus.finalized,
]


def _date_range(period: str, date_from: Optional[str], date_to: Optional[str]):
    """Resolve date range from period string or explicit dates."""
    today = date.today()

    if date_from and date_to:
        return date.fromisoformat(date_from), date.fromisoformat(date_to)

    if period == "current_month":
        return today.replace(day=1), today
    elif period == "last_month":
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        last  = today.replace(day=1) - timedelta(days=1)
        return first, last
    elif period == "last_30":
        return today - timedelta(days=30), today
    elif period == "last_90":
        return today - timedelta(days=90), today
    elif period == "last_180":
        return today - timedelta(days=180), today
    elif period == "all":
        return date(2000, 1, 1), today
    else:  # default: last_month
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        last  = today.replace(day=1) - timedelta(days=1)
        return first, last


def _base_query(db: Session, d_from: date, d_to: date):
    return db.query(Transaction).filter(
        Transaction.review_status.in_(REPORTABLE),
        Transaction.date >= d_from,
        Transaction.date <= d_to,
    )


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

@router.get("/summary")
def get_summary(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = _base_query(db, d_from, d_to).all()

    total_spend  = sum(t.amount for t in txns if t.transaction_type == TransactionType.debit)
    total_income = sum(t.amount for t in txns if t.transaction_type == TransactionType.credit)
    net          = total_income - total_spend
    count        = len(txns)
    debit_count  = sum(1 for t in txns if t.transaction_type == TransactionType.debit)
    credit_count = sum(1 for t in txns if t.transaction_type == TransactionType.credit)

    return {
        "period": {"from": str(d_from), "to": str(d_to)},
        "total_spend":   round(total_spend, 2),
        "total_income":  round(total_income, 2),
        "net":           round(net, 2),
        "count":         count,
        "debit_count":   debit_count,
        "credit_count":  credit_count,
    }


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.get("/categories")
def get_categories(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = (
        _base_query(db, d_from, d_to)
        .filter(Transaction.transaction_type == TransactionType.debit)
        .all()
    )

    # group by label
    buckets: dict[str, dict] = {}
    total = sum(t.amount for t in txns)

    for t in txns:
        label_id   = t.label_id or "__none__"
        label_name = "Uncategorized"
        label_color = "#d3d1c7"

        if t.label_id and t.label:
            label_name  = t.label.name
            label_color = t.label.color or "#d3d1c7"

        if label_id not in buckets:
            buckets[label_id] = {
                "label_id":    t.label_id,
                "label_name":  label_name,
                "color":       label_color,
                "amount":      0.0,
                "count":       0,
                "percentage":  0.0,
            }
        buckets[label_id]["amount"] += t.amount
        buckets[label_id]["count"]  += 1

    # calculate percentages and sort by amount desc
    result = []
    for b in buckets.values():
        b["amount"]     = round(b["amount"], 2)
        b["percentage"] = round(b["amount"] / total * 100, 1) if total > 0 else 0
        result.append(b)

    result.sort(key=lambda x: x["amount"], reverse=True)
    return {"period": {"from": str(d_from), "to": str(d_to)}, "categories": result, "total": round(total, 2)}


# ---------------------------------------------------------------------------
# Monthly trend
# ---------------------------------------------------------------------------

@router.get("/monthly")
def get_monthly(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # for monthly trend always use a wider window — at least 6 months
    if period in ("last_month", "current_month", "last_30"):
        d_from = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1)
        d_from = d_from - relativedelta(months=5)  # show 6 months
        d_to   = date.today()
    else:
        d_from, d_to = _date_range(period, date_from, date_to)

    txns = _base_query(db, d_from, d_to).all()

    # group by YYYY-MM
    months: dict[str, dict] = {}
    for t in txns:
        key = t.date.strftime("%Y-%m")
        if key not in months:
            months[key] = {"month": key, "spend": 0.0, "income": 0.0, "count": 0}
        if t.transaction_type == TransactionType.debit:
            months[key]["spend"] += t.amount
        else:
            months[key]["income"] += t.amount
        months[key]["count"] += 1

    result = sorted(months.values(), key=lambda x: x["month"])
    for m in result:
        m["spend"]  = round(m["spend"], 2)
        m["income"] = round(m["income"], 2)

    return {"months": result}


# ---------------------------------------------------------------------------
# Top merchants
# ---------------------------------------------------------------------------

@router.get("/merchants")
def get_merchants(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(15, le=50),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = (
        _base_query(db, d_from, d_to)
        .filter(Transaction.transaction_type == TransactionType.debit)
        .all()
    )

    merchants: dict[str, dict] = {}
    for t in txns:
        # use first 40 chars of description as merchant key
        name = (t.description or t.description_raw or "Unknown")[:40].strip()
        if name not in merchants:
            merchants[name] = {"name": name, "amount": 0.0, "count": 0}
        merchants[name]["amount"] += t.amount
        merchants[name]["count"]  += 1

    result = sorted(merchants.values(), key=lambda x: x["amount"], reverse=True)[:limit]
    for m in result:
        m["amount"] = round(m["amount"], 2)

    return {"period": {"from": str(d_from), "to": str(d_to)}, "merchants": result}