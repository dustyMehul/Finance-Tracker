from sqlalchemy import ( # type: ignore
    Column, String, Float, Date, DateTime, Boolean,
    Integer, ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import declarative_base, relationship # type: ignore
from sqlalchemy.sql import func # type: ignore
import enum
import uuid


Base = declarative_base()


def new_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class JobStatus(str, enum.Enum):
    pending    = "pending"
    processing = "processing"
    done       = "done"
    failed     = "failed"
    finalized  = "finalized"   # locked — no further edits from UI


class AccountType(str, enum.Enum):
    savings    = "savings"
    current    = "current"
    credit     = "credit"
    wallet     = "wallet"


class TransactionType(str, enum.Enum):
    debit  = "debit"
    credit = "credit"


class ReviewStatus(str, enum.Enum):
    pending  = "pending"   # not yet looked at
    approved = "approved"  # user confirmed the category
    edited   = "edited"    # user changed the category
    ignored  = "ignored"   # user excluded this transaction
    finalized = "finalized"   # locked after job is finalized

# ---------------------------------------------------------------------------
# UploadJob — one row per file the user drops
# ---------------------------------------------------------------------------

class UploadJob(Base):
    __tablename__ = "upload_jobs"

    id              = Column(String, primary_key=True, default=new_uuid)
    original_filename = Column(String, nullable=False)
    file_path       = Column(String, nullable=False)   # path inside data/uploads/
    file_hash       = Column(String, nullable=False)   # sha256, used for dedup at file level

    # user-provided metadata from the form
    bank            = Column(String, nullable=True)
    account_type    = Column(SAEnum(AccountType), nullable=True)
    account_nickname = Column(String, nullable=True)

    status          = Column(SAEnum(JobStatus), default=JobStatus.pending, nullable=False)
    error_message   = Column(Text, nullable=True)      # populated if status=failed

    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())
    finalized_at    = Column(DateTime, nullable=True)   # set when finalized

    # relationships
    transactions    = relationship("Transaction", back_populates="upload_job")


# ---------------------------------------------------------------------------
# Label — the category taxonomy (Food, Travel, Utilities…)
# ---------------------------------------------------------------------------

class Label(Base):
    __tablename__ = "labels"

    id          = Column(String, primary_key=True, default=new_uuid)
    name        = Column(String, nullable=False, unique=True)   # e.g. "Food & dining"
    slug        = Column(String, nullable=False, unique=True)   # e.g. "food_dining"
    color       = Column(String, nullable=True)                 # hex, used in UI badges
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, server_default=func.now())

    # relationships
    transactions = relationship("Transaction", back_populates="label")


# ---------------------------------------------------------------------------
# Transaction — one row per transaction line from a statement
# ---------------------------------------------------------------------------

class Transaction(Base):
    __tablename__ = "transactions"

    id              = Column(String, primary_key=True, default=new_uuid)
    upload_job_id   = Column(String, ForeignKey("upload_jobs.id"), nullable=False)
    label_id        = Column(String, ForeignKey("labels.id"), nullable=True)

    # raw fields from the statement
    date            = Column(Date, nullable=False)
    description_raw = Column(String, nullable=False)   # original, never mutated

    # enriched fields written by the pipeline
    description     = Column(String, nullable=True)    # cleaned description
    amount          = Column(Float, nullable=False)
    currency        = Column(String, default="INR")
    transaction_type = Column(SAEnum(TransactionType), nullable=False)
    balance         = Column(Float, nullable=True)     # running balance if present in statement

    # source metadata (inherited from the upload job, denormalised for easy querying)
    bank            = Column(String, nullable=True)
    account_type    = Column(SAEnum(AccountType), nullable=True)
    account_nickname = Column(String, nullable=True)

    # pipeline outputs
    category_confidence = Column(Float, nullable=True)   # 0.0–1.0 from Ollama/vector
    is_duplicate    = Column(Boolean, default=False)
    is_return       = Column(Boolean, default=False)     # flagged as a reversal/return

    # reconciliation
    review_status   = Column(SAEnum(ReviewStatus), default=ReviewStatus.pending)
    user_note       = Column(Text, nullable=True)        # free-text note from reconcile UI

    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # relationships
    upload_job      = relationship("UploadJob", back_populates="transactions")
    label           = relationship("Label", back_populates="transactions")