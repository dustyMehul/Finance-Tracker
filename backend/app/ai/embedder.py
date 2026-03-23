"""
ai/embedder.py

Generates text embeddings using Ollama's embedding endpoint.
Used by the vector store to encode transaction descriptions
and label names for similarity search.
"""

import httpx
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def embed(text: str) -> list[float] | None:
    """
    Generate an embedding vector for a single text string.
    Returns None on failure — callers must handle this gracefully.
    """
    try:
        response = httpx.post(
            f"{settings.ollama_host}/api/embeddings",
            json={
                "model": settings.ollama_embedding_model,
                "prompt": text,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        return response.json().get("embedding")
    except Exception as e:
        logger.error("Embedding failed for text '%s…': %s", text[:40], e)
        return None


def embed_batch(texts: list[str]) -> list[list[float] | None]:
    """
    Embed a list of texts. Returns a list of the same length,
    with None for any text that failed.
    """
    return [embed(t) for t in texts]