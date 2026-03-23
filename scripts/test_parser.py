"""
scripts/test_parser.py

Quick smoke test for the parser step.
Run from the backend/ directory:

    python ../scripts/test_parser.py path/to/statement.xls

Prints parsed transactions so you can verify before running the full pipeline.
"""

import sys
import os
from pathlib import Path

# Add backend/app to path so imports resolve without uvicorn
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.pipeline.context import PipelineContext
from app.pipeline.steps.parser import ParserStep


def test_file(file_path: str):
    path = Path(file_path)
    if not path.exists():
        print(f"File not found: {file_path}")
        sys.exit(1)

    fmt = path.suffix.lstrip(".")
    ctx = PipelineContext(
        job_id="test-001",
        file_path=path,
        file_format=fmt,
        bank="Test Bank",
        account_type="credit",
        account_nickname="test",
    )

    step = ParserStep()
    step.run(ctx)

    print(f"\n{'='*60}")
    print(f"File      : {path.name}")
    print(f"Format    : {fmt}")
    print(f"Parsed    : {len(ctx.raw_transactions)} transactions")
    print(f"Skipped   : {len(ctx.skipped_rows)} rows")
    print(f"Errors    : {ctx.errors or 'none'}")
    print(f"Warnings  : {ctx.warnings or 'none'}")
    print(f"{'='*60}\n")

    if ctx.raw_transactions:
        print(f"{'Date':<12} {'Type':<8} {'Amount':>12}  Description")
        print("-" * 70)
        for t in ctx.raw_transactions:
            print(f"{t.date:<12} {t.transaction_type:<8} {t.amount:>12.2f}  {t.description[:40]}")
    else:
        print("No transactions parsed.")
        if ctx.skipped_rows:
            print("\nFirst skipped row:", ctx.skipped_rows[0])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_parser.py <path-to-statement-file>")
        sys.exit(1)
    test_file(sys.argv[1])
