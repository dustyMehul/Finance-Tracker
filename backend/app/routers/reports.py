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
    elif period == "all":
        return date(2000, 1, 1), today
    else:
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        return first, today.replace(day=1) - timedelta(days=1)


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

    spend_txns    = [t for t in txns if _is_spend(t)]
    income_txns   = [t for t in txns if _is_income(t)]
    lending_out   = [t for t in txns if t.financial_nature == FinancialNature.lending
                     and t.transaction_type == TransactionType.debit]
    lending_in    = [t for t in txns if t.financial_nature == FinancialNature.lending
                     and t.transaction_type == TransactionType.credit]
    unknown_txns  = [t for t in txns if t.financial_nature == FinancialNature.unknown]

    total_spend  = sum(t.amount for t in spend_txns)
    total_income = sum(t.amount for t in income_txns)
    net          = total_income - total_spend

    return {
        "period":           {"from": str(d_from), "to": str(d_to)},
        "total_spend":      round(total_spend, 2),
        "total_income":     round(total_income, 2),
        "net":              round(net, 2),
        "count":            len(txns),
        "spend_count":      len(spend_txns),
        "income_count":     len(income_txns),
        "unknown_count":    len(unknown_txns),
        "lending_outstanding": round(
            sum(t.amount for t in lending_out) - sum(t.amount for t in lending_in), 2
        ),
    }


@router.get("/categories")
def get_categories(
    period: str = Query("last_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d_from, d_to = _date_range(period, date_from, date_to)
    txns = _base(db, d_from, d_to).all()
    spend_txns = [t for t in txns if _is_spend(t)]

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