from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Label
from app.schemas.schemas import LabelResponse, LabelCreate, LabelUpdate

router = APIRouter(prefix="/labels", tags=["labels"])


@router.get("", response_model=list[LabelResponse])
def list_labels(db: Session = Depends(get_db)):
    return db.query(Label).filter(Label.is_active == True).order_by(Label.name).all()


@router.post("", response_model=LabelResponse)
def create_label(body: LabelCreate, db: Session = Depends(get_db)):
    existing = db.query(Label).filter(Label.slug == body.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail="Label with this slug already exists.")
    label = Label(**body.model_dump())
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.patch("/{label_id}", response_model=LabelResponse)
def update_label(label_id: str, body: LabelUpdate, db: Session = Depends(get_db)):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(label, field, value)
    db.commit()
    db.refresh(label)
    return label