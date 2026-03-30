"""
routers/merchant_rules.py

GET    /merchant-rules          — list all learned merchant rules
DELETE /merchant-rules/{key}    — delete a rule (if incorrectly learned)
POST   /merchant-rules/test     — test what key would be extracted from a description
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.db import merchant_memory
from app.core.logging import get_logger

router = APIRouter(prefix="/merchant-rules", tags=["merchant-rules"])
logger = get_logger(__name__)


@router.get("")
def list_rules(db: Session = Depends(get_db)):
    return merchant_memory.list_rules(db)


@router.delete("/{merchant_key}")
def delete_rule(merchant_key: str, db: Session = Depends(get_db)):
    deleted = merchant_memory.delete_rule(merchant_key.upper(), db)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Rule '{merchant_key}' not found.")
    return {"message": f"Rule '{merchant_key}' deleted."}


class TestRequest(BaseModel):
    description: str


@router.post("/test")
def test_extraction(body: TestRequest):
    """Test what merchant key would be extracted from a description."""
    key = merchant_memory.extract_merchant_key(body.description)
    return {
        "description": body.description,
        "merchant_key": key,
        "key_length": len(key),
    }