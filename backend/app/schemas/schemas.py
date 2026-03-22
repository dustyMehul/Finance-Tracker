"""
schemas/schemas.py

Pydantic request and response models.
These are separate from ORM models — never import SQLAlchemy models here.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from enum import Enum


# ---------------------------------------------------------------------------
# Enums (mirror the ORM enums — kept separate to avoid coupling)
# ---------------------------------------------------------------------------

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


class ReviewStatusSchema(str, Enum):
    pending  = "pending"
    approved = "approved"
    edited   = "edited"
    ignored  = "ignored"


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

class UploadMetadata(BaseModel):
    """Submitted alongside the file from the upload form."""
    bank: Optional[str] = None
    account_type: Optional[AccountTypeSchema] = None
    account_nickname: Optional[str] = None


class UploadJobResponse(BaseModel):
    """Returned immediately after file is accepted."""
    job_id: str
    filename: str
    status: JobStatusSchema
    transaction_count: Optional[int] = None
    duplicate_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

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
    """PATCH body — all fields optional, only provided fields are updated."""
    label_id: Optional[str] = None
    review_status: Optional[ReviewStatusSchema] = None
    user_note: Optional[str] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

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
