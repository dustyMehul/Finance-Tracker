"""
routers/upload.py

POST /upload   — accepts a file + metadata, runs the pipeline, returns job result
GET  /upload/{job_id} — returns current job status
"""

import shutil
import hashlib
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.db.models import UploadJob, JobStatus, Transaction
from app.pipeline.context import PipelineContext
from app.pipeline.runner import run_pipeline
from app.schemas.schemas import UploadJobResponse, AccountTypeSchema
from app.core.config import settings
from app.core.logging import get_logger

router = APIRouter(prefix="/upload", tags=["upload"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _file_hash(path: Path) -> str:
    """SHA-256 hash of a file — used for file-level dedup."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _save_upload(file: UploadFile, job_id: str) -> Path:
    """Save the uploaded file to data/uploads/<job_id>_<filename>."""
    dest = settings.upload_dir / f"{job_id}_{file.filename}"
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return dest


SUPPORTED_EXTENSIONS = {".csv", ".xls", ".xlsx", ".pdf", ".ofx", ".qif"}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=UploadJobResponse)
def upload_statement(
    file: UploadFile = File(...),
    bank: Optional[str] = Form(None),
    account_type: Optional[AccountTypeSchema] = Form(None),
    account_nickname: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    # --- validate extension ---
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Accepted: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # --- create job record ---
    job = UploadJob(
        original_filename=file.filename,
        file_path="",           # updated after save
        file_hash="",           # updated after save
        bank=bank,
        account_type=account_type,
        account_nickname=account_nickname,
        status=JobStatus.processing,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    logger.info("Job %s created for file %s", job.id, file.filename)

    # --- save file to disk ---
    try:
        dest = _save_upload(file, job.id)
    except Exception as e:
        job.status = JobStatus.failed
        job.error_message = f"File save failed: {e}"
        db.commit()
        raise HTTPException(status_code=500, detail="Could not save uploaded file.")

    # --- update job with file info ---
    file_hash = _file_hash(dest)
    job.file_path = str(dest)
    job.file_hash = file_hash
    db.commit()

    # --- check for duplicate file (same hash already processed) ---
    existing = (
        db.query(UploadJob)
        .filter(
            UploadJob.file_hash == file_hash,
            UploadJob.id != job.id,
            UploadJob.status == JobStatus.done,
        )
        .first()
    )
    if existing:
        job.status = JobStatus.failed
        job.error_message = f"This file was already imported (job {existing.id})."
        db.commit()
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate file — already imported as job {existing.id}."
        )

    # --- build context and run pipeline ---
    ctx = PipelineContext(
        job_id=job.id,
        file_path=dest,
        file_format=suffix.lstrip("."),
        bank=bank,
        account_type=account_type,
        account_nickname=account_nickname,
    )

    ctx = run_pipeline(ctx, db)

    # --- build response ---
    db.refresh(job)
    transaction_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job.id
    ).count()
    duplicate_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job.id,
        Transaction.is_duplicate == True,
    ).count()

    return UploadJobResponse(
        job_id=job.id,
        filename=job.original_filename,
        status=job.status,
        transaction_count=transaction_count,
        duplicate_count=duplicate_count,
        error_message=job.error_message,
        created_at=job.created_at,
    )


@router.get("/{job_id}", response_model=UploadJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(UploadJob).filter(UploadJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    transaction_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job_id
    ).count()
    duplicate_count = db.query(Transaction).filter(
        Transaction.upload_job_id == job_id,
        Transaction.is_duplicate == True,
    ).count()

    return UploadJobResponse(
        job_id=job.id,
        filename=job.original_filename,
        status=job.status,
        transaction_count=transaction_count,
        duplicate_count=duplicate_count,
        error_message=job.error_message,
        created_at=job.created_at,
    )
