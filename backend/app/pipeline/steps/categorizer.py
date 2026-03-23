"""
pipeline/steps/categorizer.py
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
        label_slugs   = list(label_by_slug.keys())

        # debug: print all slugs loaded from DB
        logger.info("Loaded label slugs: %s", label_slugs)

        for txn in ctx.transactions:
            description = txn.get("description") or txn.get("description_raw", "")
            if not description:
                continue

            slug, confidence = ollama_client.categorize(description, label_slugs)

            # debug: print every result
            logger.info("CATEGORIZE: '%s' → slug='%s' conf=%.2f | in_map=%s",
                description[:50], slug, confidence, slug in label_by_slug)

            if slug and slug in label_by_slug:
                txn["label_id"]            = label_by_slug[slug].id
                txn["category_confidence"] = confidence
            else:
                logger.warning("Slug '%s' not found in label_by_slug", slug)

        logger.info("Categorization complete for job %s", ctx.job_id)
