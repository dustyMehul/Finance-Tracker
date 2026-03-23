"""
pipeline/runner.py

Orchestrates the pipeline steps in order.
Each step receives the full PipelineContext, mutates it, and returns nothing.
After all steps complete, transactions are bulk-inserted into the DB.

To add a new step: instantiate it and append to STEPS.
"""

from sqlalchemy.orm import Session
from datetime import date

from app.pipeline.context import PipelineContext
from app.pipeline.steps.parser import ParserStep
from app.pipeline.steps.enricher import EnricherStep
from app.pipeline.steps.categorizer import CategorizerStep
from app.db.models import Transaction, UploadJob, JobStatus
from app.core.logging import get_logger

logger = get_logger(__name__)


def run_pipeline(ctx: PipelineContext, db: Session) -> PipelineContext:
    """
    Run all pipeline steps against the given context.
    On success: bulk-inserts transactions and marks job as done.
    On failure: marks job as failed with error message.
    """
    # build steps here so categorizer gets the db session
    steps = [
        ParserStep(),
        EnricherStep(),
        CategorizerStep(db=db),
    ]

    logger.info("Pipeline starting for job %s (%s)", ctx.job_id, ctx.file_path.name)

    for step in steps:
        logger.info("Running step: %s", step)
        step.run(ctx)

        if ctx.has_errors:
            logger.error(
                "Step %s produced errors for job %s: %s",
                step, ctx.job_id, ctx.errors
            )
            _mark_job_failed(ctx.job_id, ctx.errors, db)
            return ctx

    # all steps passed — persist to DB
    if not ctx.transactions:
        ctx.add_error("Pipeline completed but produced no transactions.")
        _mark_job_failed(ctx.job_id, ctx.errors, db)
        return ctx

    try:
        _insert_transactions(ctx, db)
        _mark_job_done(ctx.job_id, db)
        logger.info(
            "Pipeline complete for job %s — %d transactions saved",
            ctx.job_id, ctx.transaction_count
        )
    except Exception as e:
        logger.exception("DB insert failed for job %s", ctx.job_id)
        ctx.add_error(f"Database insert failed: {e}")
        _mark_job_failed(ctx.job_id, ctx.errors, db)

    return ctx


def _insert_transactions(ctx: PipelineContext, db: Session) -> None:
    rows = []
    for t in ctx.transactions:
        txn_date = t["date"]
        if isinstance(txn_date, str):
            txn_date = date.fromisoformat(txn_date)

        rows.append(Transaction(
            upload_job_id=t["upload_job_id"],
            date=txn_date,
            description_raw=t["description_raw"],
            description=t["description"],
            amount=t["amount"],
            currency=t.get("currency", "INR"),
            transaction_type=t["transaction_type"],
            balance=t.get("balance"),
            bank=t.get("bank"),
            account_type=t.get("account_type"),
            account_nickname=t.get("account_nickname"),
            is_duplicate=t.get("is_duplicate", False),
            is_return=t.get("is_return", False),
            label_id=t.get("label_id"),
            category_confidence=t.get("category_confidence"),
            review_status=t.get("review_status", "pending"),
        ))

    db.bulk_save_objects(rows)
    db.commit()


def _mark_job_done(job_id: str, db: Session) -> None:
    db.query(UploadJob).filter(UploadJob.id == job_id).update({
        "status": JobStatus.done
    })
    db.commit()


def _mark_job_failed(job_id: str, errors: list[str], db: Session) -> None:
    db.query(UploadJob).filter(UploadJob.id == job_id).update({
        "status": JobStatus.failed,
        "error_message": "; ".join(errors),
    })
    db.commit()