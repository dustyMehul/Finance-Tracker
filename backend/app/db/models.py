from sqlalchemy import (
    Column, String, Float, Date, DateTime, Boolean,
    ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum
import uuid


Base = declarative_base()


def new_uuid() -> str:
    return str(uuid.uuid4())


class JobStatus(str, enum.Enum):
    pending    = "pending"
    processing = "processing"
    done       = "done"
    failed     = "failed"
    finalized  = "finalized"


class AccountType(str, enum.Enum):
    savings    = "savings"
    current    = "current"
    credit     = "credit"
    wallet     = "wallet"


class TransactionType(str, enum.Enum):
    debit  = "debit"
    credit = "credit"


class ReviewStatus(str, enum.Enum):
    pending   = "pending"
    approved  = "approved"
    edited    = "edited"
    ignored   = "ignored"
    finalized = "finalized"


class FinancialNature(str, enum.Enum):
    expense    = "expense"      # real money out — groceries, bills, rent
    income     = "income"       # real money in — salary, dividends
    investment = "investment"   # cash changing form — debit=out, credit=in
    transfer   = "transfer"     # internal move — CC payment, refund, A→B
    lending    = "lending"      # temp outside — debit=lent, credit=returned
    unknown    = "unknown"      # not yet classified — excluded from reports


class UploadJob(Base):
    __tablename__ = "upload_jobs"

    id                = Column(String, primary_key=True, default=new_uuid)
    original_filename = Column(String, nullable=False)
    file_path         = Column(String, nullable=False)
    file_hash         = Column(String, nullable=False)

    bank              = Column(String, nullable=True)
    account_type      = Column(SAEnum(AccountType), nullable=True)
    account_nickname  = Column(String, nullable=True)

    status            = Column(SAEnum(JobStatus), default=JobStatus.pending, nullable=False)
    error_message     = Column(Text, nullable=True)
    finalized_at      = Column(DateTime, nullable=True)

    created_at        = Column(DateTime, server_default=func.now())
    updated_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())

    transactions      = relationship("Transaction", back_populates="upload_job")


class Label(Base):
    __tablename__ = "labels"

    id           = Column(String, primary_key=True, default=new_uuid)
    name         = Column(String, nullable=False, unique=True)
    slug         = Column(String, nullable=False, unique=True)
    color        = Column(String, nullable=True)
    is_active    = Column(Boolean, default=True)
    # which financial_nature this label applies to — defaults to expense
    nature       = Column(String, nullable=False, default="expense")
    created_at   = Column(DateTime, server_default=func.now())

    transactions = relationship("Transaction", back_populates="label")


class Transaction(Base):
    __tablename__ = "transactions"

    id                  = Column(String, primary_key=True, default=new_uuid)
    upload_job_id       = Column(String, ForeignKey("upload_jobs.id"), nullable=False)
    label_id            = Column(String, ForeignKey("labels.id"), nullable=True)

    # raw fields
    date                = Column(Date, nullable=False)
    description_raw     = Column(String, nullable=False)
    description         = Column(String, nullable=True)
    amount              = Column(Float, nullable=False)
    currency            = Column(String, default="INR")
    transaction_type    = Column(SAEnum(TransactionType), nullable=False)
    balance             = Column(Float, nullable=True)

    # source metadata
    bank                = Column(String, nullable=True)
    account_type        = Column(SAEnum(AccountType), nullable=True)
    account_nickname    = Column(String, nullable=True)

    # pipeline outputs
    category_confidence = Column(Float, nullable=True)
    is_duplicate        = Column(Boolean, default=False)
    is_return           = Column(Boolean, default=False)

    # financial nature — the key new field
    financial_nature    = Column(SAEnum(FinancialNature), default=FinancialNature.unknown)

    # transfer matching — links both sides of a transfer pair
    transfer_pair_id    = Column(String, nullable=True)   # shared UUID on both sides
    transfer_confirmed  = Column(Boolean, default=False)  # True after user confirms match

    # reconciliation
    review_status       = Column(SAEnum(ReviewStatus), default=ReviewStatus.pending)
    user_note           = Column(Text, nullable=True)

    created_at          = Column(DateTime, server_default=func.now())
    updated_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())

    upload_job          = relationship("UploadJob", back_populates="transactions")
    label               = relationship("Label", back_populates="transactions")