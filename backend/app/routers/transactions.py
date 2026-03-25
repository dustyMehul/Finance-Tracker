"""
routers/transactions.py

GET   /transactions      — list with filters (excludes finalized by default)
PATCH /transactions/{id} — update label, review_status, note (blocked if finalized)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.db.models import Transaction, ReviewStatus, Label, FinancialNature
from app.db import vector_store
from app.ai import embedder
from app.schemas.schemas import TransactionResponse, TransactionUpdate
from app.core.logging import get_logger

router = APIRouter(prefix="/transactions", tags=["transactions"])
logger = get_logger(__name__)


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    review_status: Optional[str] = Query(None),
    upload_job_id: Optional[str] = Query(None),
    include_finalized: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)

    if not include_finalized:
        q = q.filter(Transaction.review_status != ReviewStatus.finalized)

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

    if txn.review_status == ReviewStatus.finalized:
        raise HTTPException(
            status_code=403,
            detail="Transaction is finalized and cannot be edited from the UI."
        )

    # check if label is being manually corrected
    label_changed = (
        update.label_id is not None
        and update.label_id != txn.label_id
    )

    # apply updates — exclude None but handle special cases below
    for field, value in update.model_dump(exclude_none=True).items():
        if field == "clear_label":
            continue
        setattr(txn, field, value)

    # explicitly clear label when requested or when nature=transfer/unknown
    new_nature = update.financial_nature or txn.financial_nature
    should_clear_label = (
        update.clear_label or
        str(new_nature) in ("transfer", "unknown")
    )
    if should_clear_label:
        txn.label_id = None
        label_changed = False  # don't store to vector if clearing

    db.commit()
    db.refresh(txn)

    # --- teach the vector store about this manual correction ---
    if label_changed and update.label_id:
        label = db.query(Label).filter(Label.id == update.label_id).first()
        if label:
            description = txn.description or txn.description_raw
            embedding = embedder.embed(description)
            if embedding:
                vector_store.store(description, label.slug, embedding)
                logger.info(
                    "Vector store updated: '%s' → %s (manual correction)",
                    description[:50], label.slug
                )
            else:
                logger.warning("Could not embed '%s' for vector store", description[:50])

    return txn