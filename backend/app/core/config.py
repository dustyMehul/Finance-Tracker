from pydantic_settings import BaseSettings
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent.parent  # project root


class Settings(BaseSettings):
    # --- database ---
    db_path: Path = BASE_DIR / "data" / "finance.db"

    # --- file storage ---
    upload_dir: Path = BASE_DIR / "data" / "uploads"

    # --- vector store ---
    chroma_dir: Path = BASE_DIR / "data" / "chroma"
    chroma_collection: str = "transaction_labels"

    # --- ollama ---
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    ollama_embedding_model: str = "nomic-embed-text"

    # --- pipeline ---
    dedup_window_days: int = 3        # how far back to look for duplicate transactions
    min_confidence_score: float = 0.75  # below this, categorizer flags for manual review

    # --- app ---
    log_level: str = "INFO"
    app_env: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self):
        """Create data directories if they don't exist."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)


# single shared instance — import this everywhere
settings = Settings()
