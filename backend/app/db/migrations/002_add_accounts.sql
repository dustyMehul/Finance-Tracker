-- Add account_id FK to upload_jobs (accounts table created by SQLAlchemy create_all)
ALTER TABLE upload_jobs ADD COLUMN account_id TEXT REFERENCES accounts(id);
