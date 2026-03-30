"""
pipeline/steps/categorizer.py

4-layer categorization pipeline:
  1. Keyword rules  (0.95) — deterministic, known Indian merchant patterns
  2. Merchant memory (0.90) — SQLite lookup from past manual corrections
  3. Ollama          (0.75) — unknown merchants, descriptive prompt + examples
  4. Fallback        (0.50) — "other" when nothing matches

No ChromaDB, no embeddings, no similarity thresholds.
"""

from sqlalchemy.orm import Session
from app.pipeline.steps.base import PipelineStep
from app.pipeline.context import PipelineContext
from app.ai import ollama_client
from app.db import merchant_memory
from app.db.models import Label
from app.core.logging import get_logger

logger = get_logger(__name__)

NO_LABEL_NATURES = {"transfer", "unknown"}


class CategorizerStep(PipelineStep):

    def __init__(self, db: Session):
        super().__init__()
        self.db = db

    def run(self, ctx: PipelineContext) -> None:
        if not ctx.transactions:
            ctx.add_warning("Categorizer received no transactions.")
            return

        labels = self.db.query(Label).filter(Label.is_active == True).all()
        if not labels:
            ctx.add_warning("No labels found — run seed_labels.py first.")
            return

        label_by_slug = {l.slug: l for l in labels}

        # pre-group slugs by nature
        slugs_by_nature: dict[str, list[str]] = {}
        for l in labels:
            slugs_by_nature.setdefault(l.nature, []).append(l.slug)

        logger.info(
            "Categorizing %d transactions | label groups: %s",
            len(ctx.transactions),
            {k: len(v) for k, v in slugs_by_nature.items()}
        )

        keyword_hits = 0
        memory_hits  = 0
        ollama_hits  = 0
        fallback     = 0
        skipped      = 0

        for txn in ctx.transactions:
            nature   = txn.get("financial_nature", "unknown")
            txn_type = txn.get("transaction_type", "debit")

            # transfer and unknown never get labels
            if nature in NO_LABEL_NATURES:
                skipped += 1
                continue

            description = txn.get("description") or txn.get("description_raw", "")
            if not description:
                skipped += 1
                continue

            # build candidate slugs filtered by nature + direction
            if nature == "investment":
                candidate_slugs = [
                    s for s in slugs_by_nature.get("investment", [])
                    if ("out" in s if txn_type == "debit" else "in" in s)
                ]
            elif nature == "lending":
                candidate_slugs = slugs_by_nature.get("lending", [])
            else:
                candidate_slugs = slugs_by_nature.get(nature, [])

            if not candidate_slugs:
                skipped += 1
                continue

            slug, confidence = self._categorize(
                description, candidate_slugs, nature
            )

            # track source
            if confidence >= 0.95:
                keyword_hits += 1
            elif confidence >= 0.90:
                memory_hits += 1
            elif confidence >= 0.70:
                ollama_hits += 1
            else:
                fallback += 1

            if slug and slug in label_by_slug:
                txn["label_id"]            = label_by_slug[slug].id
                txn["category_confidence"] = confidence

        logger.info(
            "Categorization done — keyword=%d memory=%d ollama=%d fallback=%d skipped=%d",
            keyword_hits, memory_hits, ollama_hits, fallback, skipped
        )

    def _categorize(self, description: str, candidate_slugs: list[str],
                    nature: str) -> tuple[str, float]:

        # Layer 1 — keyword rules (fast, deterministic)
        slug, confidence = ollama_client.categorize(description, candidate_slugs)
        if confidence >= 0.95:
            return slug, confidence

        # Layer 2 — merchant memory (SQLite, from past corrections)
        result = merchant_memory.find_match(description, self.db)
        if result:
            mem_slug, mem_conf = result
            if mem_slug in candidate_slugs:
                return mem_slug, mem_conf
            # slug in memory doesn't match this nature — skip it

        # Layer 3 — Ollama with descriptive prompt + examples
        slug, confidence = ollama_client.categorize(description, candidate_slugs)
        if slug and confidence >= 0.70:
            return slug, confidence

        # Layer 4 — fallback to "other"
        fallback_slug = "other" if "other" in candidate_slugs else \
                        candidate_slugs[0] if candidate_slugs else ""
        return fallback_slug, 0.50