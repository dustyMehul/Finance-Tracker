"""
db/vector_store.py

ChromaDB wrapper for storing and querying transaction label embeddings.

Every time a transaction is categorized (by Ollama or manually by the user),
we store the description + label in the vector store so future similar
transactions can be matched without calling Ollama.

Flow:
  1. categorizer queries vector store first (fast, free)
  2. if confidence >= threshold → use that label
  3. else → call Ollama, then store the result back
"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: chromadb.Client | None = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection

    _client = chromadb.PersistentClient(
        path=str(settings.chroma_dir),
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    _collection = _client.get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )
    logger.info("ChromaDB collection '%s' ready", settings.chroma_collection)
    return _collection


def store(description: str, label_slug: str, embedding: list[float]) -> None:
    """
    Store a description → label mapping in the vector store.
    Uses description as the document ID (deduplicates automatically).
    """
    col = _get_collection()
    # use a hash of the description as ID to avoid duplication
    doc_id = str(abs(hash(description.strip().lower())))
    try:
        col.upsert(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[description],
            metadatas=[{"label_slug": label_slug}],
        )
    except Exception as e:
        logger.error("Vector store upsert failed: %s", e)


def query(embedding: list[float], n_results: int = 1) -> tuple[str, float] | None:
    """
    Find the closest stored label for a given embedding.
    Returns (label_slug, similarity_score) or None if store is empty.
    Similarity is 1 - cosine_distance, so 1.0 = identical.
    """
    col = _get_collection()
    count = col.count()
    if count == 0:
        return None

    try:
        results = col.query(
            query_embeddings=[embedding],
            n_results=min(n_results, count),
            include=["metadatas", "distances"],
        )
        if not results["ids"][0]:
            return None

        label_slug = results["metadatas"][0][0]["label_slug"]
        distance   = results["distances"][0][0]
        similarity = 1.0 - distance   # cosine distance → similarity

        return label_slug, round(similarity, 4)
    except Exception as e:
        logger.error("Vector store query failed: %s", e)
        return None


def count() -> int:
    """Return number of stored embeddings."""
    try:
        return _get_collection().count()
    except Exception:
        return 0