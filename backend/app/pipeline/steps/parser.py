"""
pipeline/steps/parser.py

Parses uploaded bank statement files into a normalised list of RawTransaction.
Supports: CSV, XLS/XLSX, PDF, OFX/QIF

Each bank sub-parser must produce List[RawTransaction].
The enricher step never sees raw file bytes — only RawTransaction objects.
"""

import re
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Callable

from app.pipeline.steps.base import PipelineStep
from app.pipeline.context import PipelineContext, RawTransaction
from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_amount(value: str | float | int) -> float:
    """
    Parse a messy amount string into a float.
    Handles: '1,571.00'  '97,552.12'  '(500.00)'  '-200'  1571.0
    """
    if isinstance(value, (int, float)):
        return abs(float(value))
    s = str(value).strip()
    s = s.replace(',', '')          # remove thousands separators
    s = s.replace('(', '-').replace(')', '')  # (500) → -500
    try:
        return abs(float(s))
    except ValueError:
        return 0.0


def _parse_date(value: str) -> str:
    """
    Normalise various date formats to ISO 'YYYY-MM-DD'.
    Handles: '04/02/2026 / 10:05'  '04/02/2026'  '2026-02-04'  '04-Feb-2026'
    """
    if not value:
        return ""

    s = str(value).strip()

    # strip time portion after ' / ' or space
    s = re.split(r'\s*/\s*\d{2}:\d{2}', s)[0].strip()

    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%d-%b-%Y",    # 04-Feb-2026
        "%d %b %Y",    # 04 Feb 2026
        "%d/%m/%y",
        "%m/%d/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    logger.warning("Could not parse date: %s", value)
    return s  # return as-is rather than crashing


def _infer_type(amount_raw: str, description: str = "") -> str:
    """
    Infer debit/credit from raw strings.
    Credit card statements: most rows are debits (purchases).
    Payments/credits are marked with '+' prefix or keywords.
    """
    s = str(amount_raw).strip()
    desc = str(description).upper()

    if s.startswith('+'):
        return "credit"
    if any(kw in desc for kw in ["PAYMENT", "CREDIT", "REFUND", "REVERSAL", "CASHBACK"]):
        return "credit"
    return "debit"


# ---------------------------------------------------------------------------
# XLS / XLSX parser  (handles credit card statements like the ICICI format)
# ---------------------------------------------------------------------------

def _parse_xls(file_path: Path, ctx: PipelineContext) -> list[RawTransaction]:
    """
    Parses ICICI-style credit card XLS statements.

    Layout observed in sample:
      - Header rows with account summary (skip until transaction rows)
      - Transaction rows have columns roughly:
          transaction_type | cardholder | date_and_time | description | rewards | amount
      - Amount column: plain number for debits, starts with '+' for credits
      - Date format: '04/02/2026 / 10:05'
      - Two cardholders may appear (primary + add-on)
    """
    try:
        # xlrd not available — convert via pandas with openpyxl fallback
        # For genuine OLE2 .xls files, we read with xlrd if available,
        # else we instruct the user to install it.
        try:
            df = pd.read_excel(file_path, header=None, engine="xlrd")
        except Exception:
            # Fallback: try openpyxl (works if file is actually xlsx renamed)
            df = pd.read_excel(file_path, header=None, engine="openpyxl")
    except Exception as e:
        ctx.add_error(f"XLS read failed: {e}. Run: pip install xlrd")
        return []

    transactions = []

    # Find the header row — look for a row containing 'Date' or 'Description'
    header_row_idx = None
    for i, row in df.iterrows():
        row_str = " ".join(str(v).lower() for v in row if pd.notna(v))
        if "date" in row_str and "description" in row_str:
            header_row_idx = i
            break

    if header_row_idx is None:
        # No formal header found — fall back to positional parsing based on
        # ICICI credit card layout observed in the sample file
        return _parse_xls_positional(df, ctx)

    # Re-read with correct header row
    df = pd.read_excel(file_path, header=header_row_idx, engine="xlrd")
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Normalise column names
    col_map = {
        "date": ["date & time", "date", "transaction date", "txn date"],
        "description": ["description", "narration", "particulars", "merchant"],
        "amount": ["amt", "amount", "transaction amount"],
        "direction": ["debit / credit", "dr/cr", "type", "cr/dr"],
    }

    def find_col(candidates):
        for c in candidates:
            for col in df.columns:
                if c in col:
                    return col
        return None

    date_col      = find_col(col_map["date"])
    desc_col      = find_col(col_map["description"])
    amount_col    = find_col(col_map["amount"])
    direction_col = find_col(col_map["direction"])  # 'Dr' / 'Cr' column

    if not all([date_col, desc_col, amount_col]):
        ctx.add_warning(
            f"Could not map all columns. Found: date={date_col}, "
            f"desc={desc_col}, amount={amount_col}. Trying positional parse."
        )
        return _parse_xls_positional(df, ctx)

    for _, row in df.iterrows():
        date_val      = row.get(date_col)
        desc_val      = row.get(desc_col)
        amount_val    = row.get(amount_col)
        direction_val = row.get(direction_col) if direction_col else None

        # Skip summary/empty rows
        if pd.isna(date_val) or pd.isna(amount_val):
            continue
        if str(date_val).strip() in ("", "nan", "Date & Time"):
            continue

        date_str    = _parse_date(str(date_val))
        amount      = _parse_amount(amount_val)
        description = str(desc_val).strip() if pd.notna(desc_val) else ""

        # Use explicit Dr/Cr column when available — much more reliable
        if pd.notna(direction_val):
            d = str(direction_val).strip().lower()
            txn_type = "credit" if d in ("cr", "credit", "c") else "debit"
        else:
            txn_type = _infer_type(str(amount_val), description)

        if not date_str or amount == 0.0:
            ctx.skipped_rows.append(dict(row))
            continue

        transactions.append(RawTransaction(
            date=date_str,
            description=description,
            amount=amount,
            transaction_type=txn_type,
            currency="INR",
        ))

    return transactions


def _parse_xls_positional(df: pd.DataFrame, ctx: PipelineContext) -> list[RawTransaction]:
    """
    Fallback positional parser for ICICI credit card XLS layout.

    From the sample we know:
      - Date column contains strings like '04/02/2026 / 10:05'
      - Description is the next non-empty column
      - Amount is the last non-empty column on the row, a number
      - Credits have a '+NNN' rewards column just before the amount
    """
    DATE_PATTERN = re.compile(r'\d{2}/\d{2}/\d{4}')
    transactions = []

    for _, row in df.iterrows():
        values = [v for v in row if pd.notna(v) and str(v).strip() not in ("", "nan")]
        if not values:
            continue

        # Look for a date-shaped value in this row
        date_str = None
        date_idx = None
        for i, v in enumerate(values):
            if DATE_PATTERN.match(str(v).strip()):
                date_str = _parse_date(str(v))
                date_idx = i
                break

        if date_str is None:
            continue

        # Amount is the last value; skip reward point strings like '+ 165'
        amount_raw = str(values[-1]).strip()
        if re.match(r'^\+\s*\d+$', amount_raw):
            # last col is a reward points column, amount is second-to-last
            if len(values) >= 2:
                amount_raw = str(values[-2]).strip()
            else:
                ctx.skipped_rows.append(list(values))
                continue

        amount = _parse_amount(amount_raw)
        if amount == 0.0:
            continue

        # Description: value right after the date
        description = ""
        if date_idx is not None and date_idx + 1 < len(values):
            description = str(values[date_idx + 1]).strip()

        txn_type = _infer_type(amount_raw, description)

        transactions.append(RawTransaction(
            date=date_str,
            description=description,
            amount=amount,
            transaction_type=txn_type,
            currency="INR",
        ))

    return transactions


# ---------------------------------------------------------------------------
# CSV parser
# ---------------------------------------------------------------------------

def _parse_csv(file_path: Path, ctx: PipelineContext) -> list[RawTransaction]:
    """
    Generic CSV parser.
    Tries to auto-detect header row and map columns by common names.
    Works for HDFC, SBI, Axis CSV exports.
    """
    # Sniff the header row — skip preamble rows
    header_row = 0
    try:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f):
                line_lower = line.lower()
                if "date" in line_lower and ("amount" in line_lower or "debit" in line_lower):
                    header_row = i
                    break
    except Exception as e:
        ctx.add_error(f"CSV read failed: {e}")
        return []

    try:
        df = pd.read_csv(file_path, header=header_row, encoding="utf-8", errors="replace")
    except Exception as e:
        ctx.add_error(f"CSV parse failed: {e}")
        return []

    df.columns = [str(c).strip().lower() for c in df.columns]

    # Column detection
    def find(candidates):
        for c in candidates:
            for col in df.columns:
                if c in col:
                    return col
        return None

    date_col   = find(["date", "txn date", "value date", "transaction date"])
    desc_col   = find(["description", "narration", "particulars", "remarks"])
    debit_col  = find(["debit", "withdrawal", "dr"])
    credit_col = find(["credit", "deposit", "cr"])
    amount_col = find(["amount"])  # single amount column fallback
    balance_col = find(["balance", "running balance"])

    transactions = []

    for _, row in df.iterrows():
        date_val = row.get(date_col) if date_col else None
        if pd.isna(date_val) or str(date_val).strip() in ("", "nan"):
            continue

        date_str = _parse_date(str(date_val))
        description = str(row.get(desc_col, "")).strip() if desc_col else ""

        # Determine amount and type
        if debit_col and credit_col:
            debit  = _parse_amount(row.get(debit_col, 0) or 0)
            credit = _parse_amount(row.get(credit_col, 0) or 0)
            if debit > 0:
                amount, txn_type = debit, "debit"
            elif credit > 0:
                amount, txn_type = credit, "credit"
            else:
                ctx.skipped_rows.append(dict(row))
                continue
        elif amount_col:
            amount = _parse_amount(row.get(amount_col, 0))
            txn_type = _infer_type(str(row.get(amount_col, "")), description)
        else:
            ctx.skipped_rows.append(dict(row))
            continue

        balance = None
        if balance_col and pd.notna(row.get(balance_col)):
            balance = _parse_amount(row.get(balance_col))

        if amount == 0.0:
            continue

        transactions.append(RawTransaction(
            date=date_str,
            description=description,
            amount=amount,
            transaction_type=txn_type,
            balance=balance,
            currency="INR",
        ))

    return transactions


# ---------------------------------------------------------------------------
# OFX / QIF parser
# ---------------------------------------------------------------------------

def _parse_ofx(file_path: Path, ctx: PipelineContext) -> list[RawTransaction]:
    """
    Parses OFX and QIF files using the ofxparse library.
    """
    try:
        import ofxparse
    except ImportError:
        ctx.add_error("ofxparse not installed. Run: pip install ofxparse")
        return []

    transactions = []
    try:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            ofx = ofxparse.OfxParser.parse(f)

        for account in ofx.account if hasattr(ofx, 'account') else [ofx.account]:
            for txn in account.statement.transactions:
                amount = abs(float(txn.amount))
                txn_type = "credit" if float(txn.amount) > 0 else "debit"
                transactions.append(RawTransaction(
                    date=txn.date.strftime("%Y-%m-%d"),
                    description=str(txn.memo or txn.payee or "").strip(),
                    amount=amount,
                    transaction_type=txn_type,
                    currency=getattr(account.statement, 'currency', 'INR'),
                ))
    except Exception as e:
        ctx.add_error(f"OFX parse failed: {e}")

    return transactions


# ---------------------------------------------------------------------------
# PDF parser
# ---------------------------------------------------------------------------

def _parse_pdf(file_path: Path, ctx: PipelineContext) -> list[RawTransaction]:
    """
    Parses PDF bank statements using pdfplumber.
    Extracts tables from each page; falls back to text extraction.
    """
    try:
        import pdfplumber
    except ImportError:
        ctx.add_error("pdfplumber not installed. Run: pip install pdfplumber")
        return []

    transactions = []
    DATE_PATTERN = re.compile(r'\d{2}[/-]\d{2}[/-]\d{2,4}')

    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if not row:
                            continue
                        cells = [str(c).strip() if c else "" for c in row]
                        # Look for a date in any cell
                        date_str = None
                        date_idx = None
                        for i, cell in enumerate(cells):
                            if DATE_PATTERN.search(cell):
                                date_str = _parse_date(cell)
                                date_idx = i
                                break

                        if not date_str:
                            continue

                        # Amount heuristic: last numeric-looking cell
                        amount_raw = ""
                        for cell in reversed(cells):
                            cleaned = cell.replace(',', '').replace(' ', '')
                            try:
                                float(cleaned)
                                amount_raw = cell
                                break
                            except ValueError:
                                continue

                        if not amount_raw:
                            continue

                        amount = _parse_amount(amount_raw)
                        description = cells[date_idx + 1] if date_idx + 1 < len(cells) else ""
                        txn_type = _infer_type(amount_raw, description)

                        if amount > 0:
                            transactions.append(RawTransaction(
                                date=date_str,
                                description=description,
                                amount=amount,
                                transaction_type=txn_type,
                                currency="INR",
                            ))
    except Exception as e:
        ctx.add_error(f"PDF parse failed: {e}")

    return transactions


# ---------------------------------------------------------------------------
# Format dispatch
# ---------------------------------------------------------------------------

PARSERS: dict[str, Callable] = {
    "csv":  _parse_csv,
    "xls":  _parse_xls,
    "xlsx": _parse_xls,
    "ofx":  _parse_ofx,
    "qif":  _parse_ofx,
    "pdf":  _parse_pdf,
}


# ---------------------------------------------------------------------------
# PipelineStep
# ---------------------------------------------------------------------------

class ParserStep(PipelineStep):
    """
    Step 1: parse the uploaded file → ctx.raw_transactions
    """

    def run(self, ctx: PipelineContext) -> None:
        fmt = ctx.file_format.lower().lstrip(".")
        parser_fn = PARSERS.get(fmt)

        if parser_fn is None:
            ctx.add_error(f"Unsupported file format: {fmt}")
            return

        self.logger.info(
            "Parsing %s (format=%s) for job %s",
            ctx.file_path.name, fmt, ctx.job_id
        )

        raw = parser_fn(ctx.file_path, ctx)
        ctx.raw_transactions = raw

        self.logger.info(
            "Parsed %d transactions (%d skipped) for job %s",
            len(raw), len(ctx.skipped_rows), ctx.job_id
        )

        if not raw:
            ctx.add_error("Parser produced zero transactions — check the file format.")
