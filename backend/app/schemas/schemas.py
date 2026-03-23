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


class UploadMetadata(BaseModel):
    bank: Optional[str] = None
    account_type: Optional[AccountTypeSchema] = None
    account_nickname: Optional[str] = None


class UploadJobResponse(BaseModel):
    job_id: str
    filename: str
    status: JobStatusSchema
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
    review_status: ReviewStatusSchema
    user_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    label_id: Optional[str] = None
    review_status: Optional[ReviewStatusSchema] = None
    user_note: Optional[str] = None
    description: Optional[str] = None


class LabelCreate(BaseModel):
    name: str
    slug: str
    color: Optional[str] = None


class LabelResponse(BaseModel):
    id: str
    name: str
    slug: str
    color: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LabelUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None