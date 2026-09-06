from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Document, ExtractedField, AuditLog, User
from app.auth import require_inspector
from app.ocr import available_engines, primary_engine_name

router = APIRouter()

@router.get("/stats")
async def get_analytics(db: Session = Depends(get_db)):
    total_docs = db.query(Document).count()
    completed = db.query(Document).filter(Document.status == "completed").count()
    failed = db.query(Document).filter(Document.status == "failed").count()
    pending = db.query(Document).filter(Document.status == "pending").count()
    processing = db.query(Document).filter(Document.status == "processing").count()
    total_fields = db.query(ExtractedField).count()
    verified = db.query(ExtractedField).filter(ExtractedField.is_verified == True).count()
    low_conf = db.query(ExtractedField).filter(ExtractedField.confidence_score < 0.8).count()
    avg_conf = db.query(func.avg(ExtractedField.confidence_score)).scalar()
    avg_conf = round(float(avg_conf), 3) if avg_conf else 0
    return {
        "documents": {"total": total_docs, "completed": completed, "failed": failed, "pending": pending, "processing": processing},
        "fields": {"total": total_fields, "verified": verified, "low_confidence": low_conf},
        "accuracy": {"average_confidence": avg_conf, "extraction_f1": round(avg_conf, 3), "error_rate": round(1-avg_conf, 3) if avg_conf else 0},
        "pipeline": {"ocr_engine": primary_engine_name(), "available_engines": available_engines()}
    }

@router.get("/district-progress")
async def district_progress(db: Session = Depends(get_db)):
    # Aggregate by district field value actually stored in the DB.
    # Empty list when nothing has been digitized yet — no placeholder data.
    district_fields = db.query(ExtractedField).filter(ExtractedField.field_name == "district").all()
    data = []
    for district in sorted({field.field_value for field in district_fields if field.field_value}):
        document_ids = [field.document_id for field in district_fields if field.field_value == district]
        total = db.query(ExtractedField).filter(ExtractedField.document_id.in_(document_ids)).count()
        verified = db.query(ExtractedField).filter(ExtractedField.document_id.in_(document_ids), ExtractedField.is_verified == True).count()
        data.append({"district": district, "count": total, "verified": verified, "pending": total - verified})
    return {"district_progress": data}

@router.get("/confidence-distribution")
async def confidence_distribution(db: Session = Depends(get_db)):
    total = db.query(ExtractedField).count()
    if total == 0:
        return {"high": 0, "medium": 0, "low": 0, "counts": {"high": 0, "medium": 0, "low": 0}}
    high = db.query(ExtractedField).filter(ExtractedField.confidence_score >= 0.9).count()
    medium = db.query(ExtractedField).filter(ExtractedField.confidence_score >= 0.7, ExtractedField.confidence_score < 0.9).count()
    low = db.query(ExtractedField).filter(ExtractedField.confidence_score < 0.7).count()
    return {"high": round(high/total*100,1), "medium": round(medium/total*100,1), "low": round(low/total*100,1), "counts": {"high": high, "medium": medium, "low": low}}

@router.get("/uploads-trend")
async def uploads_trend(db: Session = Depends(get_db)):
    """Documents ingested per day for the last 14 days (real DB data)."""
    from datetime import datetime, timedelta, timezone
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=13)
    rows = (
        db.query(func.date(Document.created_at), func.count(Document.id))
        .filter(func.date(Document.created_at) >= start.isoformat())
        .group_by(func.date(Document.created_at))
        .all()
    )
    by_day = {r[0]: r[1] for r in rows}
    trend = []
    for i in range(14):
        day = start + timedelta(days=i)
        trend.append({"date": day.isoformat(), "label": day.strftime("%a"), "volume": by_day.get(day.isoformat(), 0)})
    peak = max(trend, key=lambda t: t["volume"]) if trend else {"volume": 0}
    return {"trend": trend, "peak": peak}

@router.get("/recent-activity")
async def recent_activity(limit: int = 10, db: Session = Depends(get_db)):
    """Latest audit-log entries (real pipeline activity, newest first)."""
    from app.models import AuditLog
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 50)).all()
    _USERS = {u.id: u.email for u in db.query(User).all()}
    items = []
    for log in logs:
        doc_name = None
        if log.entity_type == "document":
            doc = db.query(Document).filter(Document.id == log.entity_id).first()
            doc_name = doc.filename if doc else f"Doc #{log.entity_id}"
        elif log.entity_type == "extracted_field":
            field = db.query(ExtractedField).filter(ExtractedField.id == log.entity_id).first()
            if field:
                doc = db.query(Document).filter(Document.id == field.document_id).first()
                doc_name = f"{field.field_name} — {doc.filename}" if doc else field.field_name
        items.append({
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "detail": doc_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "user_id": log.user_id,
            "user_email": _USERS.get(log.user_id, f"user #{log.user_id}"),
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return {"activity": items}


@router.get("/user-activity")
async def user_activity(limit: int = 50, db: Session = Depends(get_db), _inspector: User = Depends(require_inspector)):
    """Inspector oversight: per-user work summary + full audit trail with user emails."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    user_rows = []
    for u in users:
        docs = db.query(Document).filter(Document.uploaded_by == u.id).count()
        verified = db.query(ExtractedField).filter(ExtractedField.verified_by == u.id).count()
        logins = db.query(AuditLog).filter(AuditLog.user_id == u.id, AuditLog.action == "login").count()
        last_doc = db.query(func.max(Document.created_at)).filter(Document.uploaded_by == u.id).scalar()
        last_log = db.query(func.max(AuditLog.created_at)).filter(AuditLog.user_id == u.id).scalar()
        last_active = max([d for d in [last_doc, last_log, u.created_at] if d], default=None)
        user_rows.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "documents_uploaded": docs,
            "fields_verified": verified,
            "logins": logins,
            "last_active": last_active.isoformat() if last_active else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(max(limit, 1), 200)).all()
    emails = {u.id: u.email for u in users}
    trail = []
    for log in logs:
        detail = None
        if log.entity_type == "document":
            doc = db.query(Document).filter(Document.id == log.entity_id).first()
            detail = doc.filename if doc else f"Doc #{log.entity_id}"
        elif log.entity_type == "extracted_field":
            field = db.query(ExtractedField).filter(ExtractedField.id == log.entity_id).first()
            detail = field.field_name if field else f"field #{log.entity_id}"
        elif log.entity_type == "user":
            detail = log.new_value
        trail.append({
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "detail": detail,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "user_id": log.user_id,
            "user_email": emails.get(log.user_id, f"user #{log.user_id}"),
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return {"users": user_rows, "total_users": len(user_rows), "trail": trail}
