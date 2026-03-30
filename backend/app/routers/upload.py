"""
routers/upload.py

POST /upload              — accepts file + metadata, runs pipeline
GET  /upload/jobs         — list all upload jobs with counts
GET  /upload/{job_id}     — single job status
POST /upload/{job_id}/finalize — lock all transactions for a job
"""

import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.db.models import UploadJob, JobStatus, Transaction, ReviewStatus, Account
from app.pipeline.context import PipelineContext
from app.pipeline.runner import run_pipeline
from app.schemas.schemas import UploadJobResponse, AccountTypeSchema
from app.core.config import settings
from app.core.backup import backup
from app.core.logging import get_logger

router = APIRouter(prefix="/upload", tags=["upload"])
logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".csv", ".xls", ".xlsx", ".pdf", ".ofx", ".qif"}


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _save_upload(file: UploadFile, job_id: str) -> Path:
    dest = settings.upload_dir / f"{job_id}_{file.filename}"
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return dest


def _job_response(job: UploadJob, db: Session) -> UploadJobResponse:
    """Build UploadJobResponse with live counts from DB."""
    transaction_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job.id
    ).count()
    duplicate_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job.id,
        Transaction.is_duplicate == True,
    ).count()
    pending_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job.id,
        Transaction.review_status == ReviewStatus.pending,
    ).count()
    return UploadJobResponse(
        job_id=job.id,
        filename=job.original_filename,
        status=job.status,
        transaction_count=transaction_count,
        duplicate_count=duplicate_count,
        pending_count=pending_count,
        error_message=job.error_message,
        finalized_at=job.finalized_at,
        created_at=job.created_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/jobs", response_model=list[UploadJobResponse])
def list_jobs(db: Session = Depends(get_db)):
    """List all upload jobs, most recent first."""
    jobs = db.query(UploadJob).order_by(UploadJob.created_at.desc()).all()
    return [_job_response(j, db) for j in jobs]


@router.post("", response_model=UploadJobResponse)
def upload_statement(
    file: UploadFile = File(...),
    account_id: Optional[str] = Form(None),
    bank: Optional[str] = Form(None),
    account_type: Optional[AccountTypeSchema] = Form(None),
    account_nickname: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Accepted: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # If account_id provided, populate metadata from the linked Account
    if account_id:
        acct = db.query(Account).filter(Account.id == account_id, Account.is_active == True).first()
        if not acct:
            raise HTTPException(status_code=404, detail="Account not found.")
        bank = acct.bank
        account_type = acct.account_type
        account_nickname = acct.display_name

    job = UploadJob(
        original_filename=file.filename,
        file_path="",
        file_hash="",
        account_id=account_id,
        bank=bank,
        account_type=account_type,
        account_nickname=account_nickname,
        status=JobStatus.processing,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    logger.info("Job %s created for file %s", job.id, file.filename)

    try:
        dest = _save_upload(file, job.id)
    except Exception as e:
        job.status = JobStatus.failed
        job.error_message = f"File save failed: {e}"
        db.commit()
        raise HTTPException(status_code=500, detail="Could not save uploaded file.")

    file_hash = _file_hash(dest)
    job.file_path = str(dest)
    job.file_hash = file_hash
    db.commit()

    existing = (
        db.query(UploadJob)
        .filter(
            UploadJob.file_hash == file_hash,
            UploadJob.id != job.id,
            UploadJob.status.in_([JobStatus.done, JobStatus.finalized]),
        )
        .first()
    )
    if existing:
        job.status = JobStatus.failed
        job.error_message = f"Already imported as job {existing.id}."
        db.commit()
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate file — already imported as job {existing.id}."
        )

    ctx = PipelineContext(
        job_id=job.id,
        file_path=dest,
        file_format=suffix.lstrip("."),
        bank=bank,
        account_type=account_type,
        account_nickname=account_nickname,
    )
    ctx = run_pipeline(ctx, db)
    db.refresh(job)

    # backup DB after every successful upload
    if job.status == JobStatus.done:
        backup(reason=f"post-upload: {job.original_filename}")

    return _job_response(job, db)


@router.get("/{job_id}", response_model=UploadJobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _job_response(job, db)


@router.post("/{job_id}/finalize", response_model=UploadJobResponse)
def finalize_job(job_id: str, db: Session = Depends(get_db)):
    """
    Finalize all transactions for this job:
    - Auto-approve any remaining pending transactions
    - Mark all transactions as finalized (locked)
    - Mark the job itself as finalized
    """
    job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status == JobStatus.finalized:
        raise HTTPException(status_code=409, detail="Job already finalized.")
    if job.status != JobStatus.done:
        raise HTTPException(status_code=400, detail="Job must be in 'done' status to finalize.")

    # auto-approve pending, then lock everything
    txns = db.query(Transaction).filter(Transaction.upload_job_id == job_id).all()
    for txn in txns:
        if txn.review_status == ReviewStatus.pending:
            txn.review_status = ReviewStatus.approved
        # lock all — including approved, edited, ignored
        txn.review_status = ReviewStatus.finalized

    job.status       = JobStatus.finalized
    job.finalized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)

    logger.info("Job %s finalized — %d transactions locked", job_id, len(txns))
    return _job_response(job, db)