from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import ExtractedField, Document, AuditLog, User
from app.auth import require_inspector, get_current_active_user

router = APIRouter()

class VerifyIn(BaseModel):
    verified_value: Optional[str] = None

@router.get("/pending")
async def pending_verifications(limit: int = 50, db: Session = Depends(get_db), _user: User = Depends(get_current_active_user)):
    # Confidence <0.80 gates to verification queue per PS SIH26018
    fields = db.query(ExtractedField).filter(ExtractedField.confidence_score < 0.8, ExtractedField.is_verified == False).order_by(ExtractedField.confidence_score.asc()).limit(limit).all()
    result = []
    for f in fields:
        doc = db.query(Document).filter(Document.id == f.document_id).first()
        result.append({
            "field_id": f.id,
            "document_id": f.document_id,
            "document_name": doc.filename if doc else None,
            "document_type": doc.file_type if doc else None,
            "field_name": f.field_name,
            "field_value": f.field_value,
            "confidence": f.confidence_score,
            "created_at": f.created_at.isoformat() if f.created_at else None
        })
    return {"total": len(result), "pending": result}

@router.post("/verify/{field_id}")
async def verify_field(field_id: int, payload: VerifyIn, db: Session = Depends(get_db), _inspector: User = Depends(require_inspector)):
    field = db.query(ExtractedField).filter(ExtractedField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    old_val = field.field_value
    if payload.verified_value is not None:
        field.field_value = payload.verified_value
    field.is_verified = True
    field.verified_by = _inspector.id
    field.verified_at = datetime.now(timezone.utc)
    # bump confidence to 0.99 on human verification
    field.confidence_score = 0.99
    db.add(field)
    # audit
    audit = AuditLog(user_id=_inspector.id, action="verify", entity_type="extracted_field", entity_id=field.id, old_value=old_val, new_value=field.field_value)
    db.add(audit)
    db.commit()
    db.refresh(field)
    return {"message": "Field verified", "field_id": field.id, "field_name": field.field_name, "field_value": field.field_value, "confidence": field.confidence_score}

@router.get("/stats")
async def verification_stats(db: Session = Depends(get_db), _user: User = Depends(get_current_active_user)):
    total = db.query(ExtractedField).count()
    pending = db.query(ExtractedField).filter(ExtractedField.confidence_score < 0.8, ExtractedField.is_verified == False).count()
    verified = db.query(ExtractedField).filter(ExtractedField.is_verified == True).count()
    return {"total_fields": total, "pending": pending, "verified": verified, "pending_rate": round(pending/max(total,1), 3)}
