from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class RawTransaction:
    """
    Normalised output of the parser step.
    Every parser (CSV, PDF, OFX) must produce a list of these.
    Fields are intentionally loose (str/float) — enricher tightens them.
    """
    date: str               # ISO string "YYYY-MM-DD" — parser normalises all formats
    description: str        # raw description from the statement
    amount: float           # always positive; transaction_type tells direction
    transaction_type: str   # "debit" or "credit"
    balance: float | None = None
    currency: str = "INR"
    extra: dict = field(default_factory=dict)  # any bank-specific fields worth keeping


@dataclass
class PipelineContext:
    """
    Shared state passed between pipeline steps.
    Steps read from it and write back to it — nothing is returned.

    Lifecycle:
        runner.py creates one context per upload job,
        passes it through each step in order,
        then persists the result to the DB.
    """

    # --- inputs (set before pipeline runs) ---
    job_id: str
    file_path: Path
    file_format: str            # "csv" | "pdf" | "ofx" | "qif"

    # user-supplied metadata from the upload form
    bank: str | None = None
    account_type: str | None = None
    account_nickname: str | None = None

    # --- written by parser step ---
    raw_transactions: list[RawTransaction] = field(default_factory=list)

    # --- written by enricher step ---
    transactions: list[dict] = field(default_factory=list)
    # each dict matches the Transaction ORM model fields,
    # ready to be bulk-inserted after the pipeline completes

    # --- written by categorizer step ---
    # categories are written directly onto each transaction dict as:
    #   t["label_id"], t["category_confidence"]

    # --- pipeline health ---
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    skipped_rows: list[Any] = field(default_factory=list)  # rows that couldn't be parsed

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    @property
    def transaction_count(self) -> int:
        return len(self.transactions)

    def add_error(self, msg: str):
        self.errors.append(msg)

    def add_warning(self, msg: str):
        self.warnings.append(msg)
