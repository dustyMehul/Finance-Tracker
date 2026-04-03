from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from enum import Enum


class AccountTypeSchema(str, Enum):
    savings = "savings"
    current = "current"
    credit  = "credit"
    wallet  = "wallet"


class JobStatusSchema(str, Enum):
    pending    = "pending"
    processing = "processing"
    done       = "done"
    failed     = "failed"
    finalized  = "finalized"


class ReviewStatusSchema(str, Enum):
    pending   = "pending"
    approved  = "approved"
    edited    = "edited"
    ignored   = "ignored"
    finalized = "finalized"


class FinancialNatureSchema(str, Enum):
    expense    = "expense"
    income     = "income"
    investment = "investment"
    transfer   = "transfer"
    lending    = "lending"
    unknown    = "unknown"


class UploadMetadata(BaseModel):
    bank: Optional[str] = None
    account_type: Optional[AccountTypeSchema] = None
    account_nickname: Optional[str] = None


class UploadJobResponse(BaseModel):
    job_id: str
    filename: str
    status: JobStatusSchema
    account_id: Optional[str] = None
    transaction_count: Optional[int] = None
    duplicate_count: Optional[int] = None
    pending_count: Optional[int] = None
    error_message: Optional[str] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: str
    upload_job_id: str
    date: date
    description_raw: str
    description: str
    amount: float
    currency: str
    transaction_type: str
    balance: Optional[float] = None
    bank: Optional[str] = None
    account_type: Optional[str] = None
    account_nickname: Optional[str] = None
    label_id: Optional[str] = None
    category_confidence: Optional[float] = None
    is_duplicate: bool
    is_return: bool
    financial_nature: Optional[FinancialNatureSchema] = None
    transfer_pair_id: Optional[str] = None
    transfer_confirmed: bool = False
    review_status: ReviewStatusSchema
    user_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    label_id: Optional[str] = None           # set to "" to clear the label
    review_status: Optional[ReviewStatusSchema] = None
    user_note: Optional[str] = None
    description: Optional[str] = None
    financial_nature: Optional[FinancialNatureSchema] = None
    clear_label: bool = False                # explicitly clear label_id to None


class TransferSuggestion(BaseModel):
    """A suggested transfer pair — two transactions that likely cancel each other."""
    txn_a: TransactionResponse   # the outflow (debit)
    txn_b: TransactionResponse   # the inflow (credit)
    amount: float
    days_apart: int
    confidence: float            # 1.0 = exact match, <1.0 = fuzzy


class ConfirmTransfer(BaseModel):
    txn_a_id: str
    txn_b_id: str


class LabelCreate(BaseModel):
    name: str
    slug: str
    color: Optional[str] = None
    nature: str = "expense"    # defaults to expense when adding from Labels page


class LabelResponse(BaseModel):
    id: str
    name: str
    slug: str
    color: Optional[str] = None
    is_active: bool
    nature: str
    created_at: datetime

    class Config:
        from_attributes = True


class LabelUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    nature: Optional[str] = None


class AccountCreate(BaseModel):
    display_name: str
    bank: Optional[str] = None
    account_type: Optional[AccountTypeSchema] = None
    last_4: Optional[str] = None
    color: Optional[str] = None


class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    bank: Optional[str] = None
    account_type: Optional[AccountTypeSchema] = None
    last_4: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class AccountResponse(BaseModel):
    id: str
    display_name: str
    bank: Optional[str] = None
    account_type: Optional[str] = None
    last_4: Optional[str] = None
    color: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True