"""
routers/transactions.py

GET   /transactions          — list with optional filters
PATCH /transactions/{id}     — update label, review_status, note
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.db.models import Transaction
from app.schemas.schemas import TransactionResponse, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    review_status: Optional[str] = Query(None),
    upload_job_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if review_status:
        q = q.filter(Transaction.review_status == review_status)
    if upload_job_id:
        q = q.filter(Transaction.upload_job_id == upload_job_id)
    q = q.order_by(Transaction.date.desc())
    return q.offset(skip).limit(limit).all()


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: str,
    update: TransactionUpdate,
    db: Session = Depends(get_db),
):
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    for field, value in update.model_dump(exclude_none=True).items():
        setattr(txn, field, value)

    db.commit()
    db.refresh(txn)
    return txn
