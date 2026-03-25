"""
routers/transfers.py

GET  /transfers/suggestions     — find candidate transfer pairs
POST /transfers/confirm         — confirm a suggested pair
POST /transfers/unlink/{txn_id} — unlink a previously confirmed pair
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import timedelta
import uuid

from app.db.database import get_db
from app.db.models import Transaction, TransactionType, FinancialNature, ReviewStatus
from app.schemas.schemas import TransferSuggestion, TransactionResponse, ConfirmTransfer
from app.core.logging import get_logger

router = APIRouter(prefix="/transfers", tags=["transfers"])
logger = get_logger(__name__)

MATCH_WINDOW_DAYS = 3    # how many days apart two transactions can be to match
MIN_AMOUNT        = 100  # ignore tiny amounts — not worth matching


@router.get("/suggestions", response_model=list[TransferSuggestion])
def get_suggestions(db: Session = Depends(get_db)):
    """
    Find unconfirmed transfer candidates:
    - One debit, one credit
    - Same amount (exact)
    - Within MATCH_WINDOW_DAYS of each other
    - Different accounts (different upload_job or different account_nickname)
    - Not already paired
    - Not finalized
    """
    # get all unlinked, non-finalized transactions
    txns = db.query(Transaction).filter(
        Transaction.transfer_pair_id == None,
        Transaction.review_status != ReviewStatus.finalized,
        Transaction.amount >= MIN_AMOUNT,
    ).order_by(Transaction.date).all()

    debits  = [t for t in txns if t.transaction_type == TransactionType.debit]
    credits = [t for t in txns if t.transaction_type == TransactionType.credit]

    suggestions = []
    used_ids = set()

    for debit in debits:
        if debit.id in used_ids:
            continue
        for credit in credits:
            if credit.id in used_ids:
                continue
            if debit.id == credit.id:
                continue

            # same amount
            if abs(debit.amount - credit.amount) > 0.01:
                continue

            # within date window
            days_apart = abs((debit.date - credit.date).days)
            if days_apart > MATCH_WINDOW_DAYS:
                continue

            # different accounts — at least one of: different job, different nickname
            same_job      = debit.upload_job_id == credit.upload_job_id
            same_nickname = (
                debit.account_nickname and
                credit.account_nickname and
                debit.account_nickname == credit.account_nickname
            )
            if same_job and same_nickname:
                continue  # same account — not a transfer

            # confidence: exact date = 1.0, each day apart reduces by 0.2
            confidence = round(1.0 - (days_apart * 0.2), 1)

            suggestions.append(TransferSuggestion(
                txn_a=TransactionResponse.model_validate(debit),
                txn_b=TransactionResponse.model_validate(credit),
                amount=debit.amount,
                days_apart=days_apart,
                confidence=confidence,
            ))

            used_ids.add(debit.id)
            used_ids.add(credit.id)
            break  # one match per debit

    # sort by confidence desc
    suggestions.sort(key=lambda s: s.confidence, reverse=True)
    return suggestions


@router.post("/confirm")
def confirm_transfer(body: ConfirmTransfer, db: Session = Depends(get_db)):
    """
    Confirm a transfer pair — links both transactions and marks them as transfer.
    """
    txn_a = db.query(Transaction).filter(Transaction.id == body.txn_a_id).first()
    txn_b = db.query(Transaction).filter(Transaction.id == body.txn_b_id).first()

    if not txn_a or not txn_b:
        raise HTTPException(status_code=404, detail="One or both transactions not found.")

    if txn_a.review_status == ReviewStatus.finalized or txn_b.review_status == ReviewStatus.finalized:
        raise HTTPException(status_code=403, detail="Cannot modify finalized transactions.")

    pair_id = str(uuid.uuid4())

    for txn in [txn_a, txn_b]:
        txn.transfer_pair_id   = pair_id
        txn.transfer_confirmed = True
        txn.financial_nature   = FinancialNature.transfer
        txn.review_status      = ReviewStatus.approved  # auto-approve confirmed transfers

    db.commit()
    logger.info("Transfer pair confirmed: %s ↔ %s (pair=%s)", txn_a.id, txn_b.id, pair_id)
    return {"pair_id": pair_id, "message": "Transfer pair confirmed."}


@router.post("/unlink/{txn_id}")
def unlink_transfer(txn_id: str, db: Session = Depends(get_db)):
    """Unlink a transfer pair — both sides revert to unknown nature."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if not txn.transfer_pair_id:
        raise HTTPException(status_code=400, detail="Transaction is not part of a transfer pair.")

    pair_id = txn.transfer_pair_id

    # unlink both sides
    paired = db.query(Transaction).filter(
        Transaction.transfer_pair_id == pair_id
    ).all()

    for t in paired:
        t.transfer_pair_id   = None
        t.transfer_confirmed = False
        t.financial_nature   = FinancialNature.unknown
        t.review_status      = ReviewStatus.pending

    db.commit()
    logger.info("Transfer pair unlinked: pair=%s", pair_id)
    return {"message": f"Transfer pair {pair_id} unlinked."}