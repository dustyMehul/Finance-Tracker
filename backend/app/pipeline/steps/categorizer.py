"""
pipeline/steps/categorizer.py

Assigns labels to transactions based on financial_nature.
- transfer / unknown → no label ever
- expense → expense labels only
- income → income labels only
- investment debit → investment_out labels only
- investment credit → investment_in labels only
- lending → lending labels only
"""

from sqlalchemy.orm import Session
from app.pipeline.steps.base import PipelineStep
from app.pipeline.context import PipelineContext
from app.ai import ollama_client, embedder
from app.db import vector_store
from app.db.models import Label
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# natures that never get labels
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

        # pre-group slugs by nature for fast lookup
        slugs_by_nature: dict[str, list[str]] = {}
        for l in labels:
            slugs_by_nature.setdefault(l.nature, []).append(l.slug)

        logger.info(
            "Categorizing %d transactions, label groups: %s",
            len(ctx.transactions),
            {k: len(v) for k, v in slugs_by_nature.items()}
        )

        vector_hits = 0
        ollama_hits = 0
        skipped     = 0

        for txn in ctx.transactions:
            nature   = txn.get("financial_nature", "unknown")
            txn_type = txn.get("transaction_type", "debit")

            # no labels for these natures
            if nature in NO_LABEL_NATURES:
                skipped += 1
                continue

            description = txn.get("description") or txn.get("description_raw", "")
            if not description:
                skipped += 1
                continue

            # pick candidate slugs based on nature + direction
            if nature == "investment":
                # debit = money out = investment_out label
                # credit = money in = investment_in label
                if txn_type == "debit":
                    candidate_slugs = [s for s in slugs_by_nature.get("investment", []) if "out" in s]
                else:
                    candidate_slugs = [s for s in slugs_by_nature.get("investment", []) if "in" in s]
            elif nature == "lending":
                candidate_slugs = slugs_by_nature.get("lending", [])
            else:
                candidate_slugs = slugs_by_nature.get(nature, [])

            if not candidate_slugs:
                skipped += 1
                continue

            label_slug, confidence = self._categorize(description, candidate_slugs)

            if label_slug and label_slug in label_by_slug:
                txn["label_id"]            = label_by_slug[label_slug].id
                txn["category_confidence"] = confidence
                logger.debug("Categorized '%s' → %s (%.0f%%)", description[:40], label_slug, confidence * 100)
                if confidence >= settings.min_confidence_score:
                    vector_hits += 1 if confidence == 1.0 else 0
                    ollama_hits += 1 if confidence < 1.0 else 0

        logger.info(
            "Categorization done — %d vector hits, %d ollama hits, %d skipped",
            vector_hits, ollama_hits, skipped
        )

    def _categorize(self, description: str, candidate_slugs: list[str]) -> tuple[str, float]:
        # query vector store first — only use result if slug is valid for this nature
        embedding = embedder.embed(description)
        if embedding:
            result = vector_store.query(embedding)
            if result:
                slug, similarity = result
                if (similarity >= settings.min_confidence_score
                        and slug in candidate_slugs
                        and similarity >= 0.92):   # high bar — avoid cross-category pollution
                    logger.debug("Vector hit: '%s' → %s (%.2f)", description[:40], slug, similarity)
                    return slug, similarity

        # fall back to keyword rules + Ollama
        # NOTE: we do NOT store to vector here — vector store only learns from
        # manual corrections in the UI (routers/transactions.py PATCH endpoint)
        slug, confidence = ollama_client.categorize(description, candidate_slugs)
        return slug, confidence