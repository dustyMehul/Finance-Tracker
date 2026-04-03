from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Account
from app.schemas.schemas import AccountCreate, AccountUpdate, AccountResponse

router = APIRouter()


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db)):
    """List all active accounts."""
    return db.query(Account).filter(Account.is_active == True).order_by(Account.created_at).all()


@router.get("/all", response_model=list[AccountResponse])
def list_all_accounts(db: Session = Depends(get_db)):
    """List all accounts including inactive."""
    return db.query(Account).order_by(Account.created_at).all()


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(body: AccountCreate, db: Session = Depends(get_db)):
    existing = db.query(Account).filter(Account.display_name == body.display_name).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this display name already exists.")
    account = Account(
        display_name=body.display_name,
        bank=body.bank,
        account_type=body.account_type,
        last_4=body.last_4,
        color=body.color,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(account_id: str, body: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")
    account.is_active = False
    db.commit()
