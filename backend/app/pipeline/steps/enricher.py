"""
pipeline/steps/enricher.py

Reads ctx.raw_transactions, applies enrichment, writes to ctx.transactions.
Each item in ctx.transactions is a dict matching the Transaction ORM model fields,
ready for bulk insert after the pipeline completes.

Enrichment done here (per user preference — minimal, strict):
  - Dedup: same date + amount + description within the same upload job
  - Return detection: credits that look like reversals of a prior debit
  - Copies description_raw → description (no cleaning, kept as-is)
  - Inherits bank/account metadata from ctx onto every transaction
"""

from app.pipeline.steps.base import PipelineStep
from app.pipeline.context import PipelineContext


class EnricherStep(PipelineStep):

    def run(self, ctx: PipelineContext) -> None:
        if not ctx.raw_transactions:
            ctx.add_error("Enricher received no raw transactions to process.")
            return

        self.logger.info(
            "Enriching %d raw transactions for job %s",
            len(ctx.raw_transactions), ctx.job_id
        )

        seen: set[tuple] = set()   # for dedup within this upload batch
        transactions = []

        for raw in ctx.raw_transactions:
            # --- dedup: strict match on date + amount + description ---
            key = (raw.date, raw.amount, raw.description.strip().lower())
            is_duplicate = key in seen
            if not is_duplicate:
                seen.add(key)

            # --- return detection ---
            # A credit that contains reversal keywords is flagged as a return.
            # Actual payments (e.g. "CC PAYMENT") are NOT flagged as returns —
            # they are legitimate credits. Only flag reversals/refunds.
            desc_upper = raw.description.upper()
            is_return = (
                raw.transaction_type == "credit"
                and any(kw in desc_upper for kw in (
                    "REVERSAL", "REFUND", "CHARGEBACK", "DISPUTE", "CANCELLED"
                ))
            )

            transactions.append({
                # job linkage
                "upload_job_id": ctx.job_id,

                # raw fields — description_raw is never mutated
                "date": raw.date,
                "description_raw": raw.description,
                "description": raw.description,   # no cleaning per user preference
                "amount": raw.amount,
                "currency": raw.currency,
                "transaction_type": raw.transaction_type,
                "balance": raw.balance,

                # source metadata from upload form
                "bank": ctx.bank,
                "account_type": ctx.account_type,
                "account_nickname": ctx.account_nickname,

                # pipeline flags
                "is_duplicate": is_duplicate,
                "is_return": is_return,

                # defaults — categorizer fills these in next step
                "label_id": None,
                "category_confidence": None,

                # reconciliation default
                "review_status": "pending",
            })

        ctx.transactions = transactions

        dup_count = sum(1 for t in transactions if t["is_duplicate"])
        ret_count = sum(1 for t in transactions if t["is_return"])

        self.logger.info(
            "Enrichment done — %d transactions, %d duplicates flagged, %d returns flagged",
            len(transactions), dup_count, ret_count
        )

        if dup_count:
            ctx.add_warning(
                f"{dup_count} duplicate transaction(s) flagged — "
                "they will be saved but marked is_duplicate=True."
            )
