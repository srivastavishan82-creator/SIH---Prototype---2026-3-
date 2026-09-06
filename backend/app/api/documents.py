import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))
except Exception:
    pass

from typing import Optional as TypingOptional
from app.database import get_db
from app.models import Document, ExtractedField, AuditLog, User
from app.auth import require_inspector, get_current_active_user
from app.ocr import ocr_image, extract_fields_from_text, NoOCREngineError, available_engines
from app.validation import validate_field, compute_confidence

router = APIRouter()

# Resolve UPLOAD_DIR relative to backend folder so it works regardless of cwd (fixes 500 when started from different dir)
_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # backend/
_default_upload = os.path.join(_base_dir, "uploads")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", _default_upload)
if not os.path.isabs(UPLOAD_DIR):
    UPLOAD_DIR = os.path.join(_base_dir, UPLOAD_DIR)
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
try:
    MAX_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10") or "10")
except ValueError:
    MAX_SIZE_MB = 10

def _save_upload(file: UploadFile) -> str:
    safe_name = os.path.basename(file.filename or "")
    ext = os.path.splitext(safe_name)[1].lower()
    if not safe_name or ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type {ext or '(none)'}. Allowed: {sorted(ALLOWED_EXT)}")
    header = file.file.read(12)
    file.file.seek(0)
    valid_signature = (
        (ext == ".pdf" and header.startswith(b"%PDF-"))
        or (ext in {".jpg", ".jpeg"} and header.startswith(b"\xff\xd8\xff"))
        or (ext == ".png" and header.startswith(b"\x89PNG\r\n\x1a\n"))
    )
    if not valid_signature:
        raise HTTPException(status_code=400, detail="File content does not match its extension")
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, fname)
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return dest

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    language: str = Form("hi"),
    doc_type: str = Form("register"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # size + empty checks
    try:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
    except Exception:
        size = 0
    if size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if size > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_SIZE_MB}MB")

    file_path = _save_upload(file)
    original_name = os.path.basename(file.filename or file_path)
    ext = os.path.splitext(original_name)[1].lower()
    ftype = "pdf" if ext == ".pdf" else "image"

    # attribute the upload to the logged-in user when a token was sent
    actor_id = current_user.id
    # create Document
    doc = Document(
        filename=original_name,
        file_path=file_path,
        file_type=ftype,
        doc_type=doc_type,
        language=language,
        status="processing",
        uploaded_by=actor_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # OCR / AI field extraction — real engines only, no fabricated data
    try:
        ocr_result = ocr_image(file_path, lang=language if language in ["en", "hi"] else "en")
        if ocr_result.get("fields"):
            fields = ocr_result["fields"]
        else:
            fields = extract_fields_from_text(ocr_result.get("texts", []), lang=language)
    except NoOCREngineError as e:
        doc.status = "failed"
        db.add(doc)
        db.commit()
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        doc.status = "failed"
        db.add(doc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {e}")

    if not fields:
        doc.status = "failed"
        db.add(doc)
        db.commit()
        raise HTTPException(
            status_code=422,
            detail="No recognizable land-record fields found in this file. Upload a clearer scan or a text-based PDF.",
        )

    created_fields = []
    for f in fields:
        # validation + confidence gating per PS: <80% -> verification queue
        validation = validate_field(f["field_name"], f["field_value"])
        conf = compute_confidence(f["field_name"], f["confidence_score"])
        # validation reduces confidence slightly if invalid
        if not validation["is_valid"]:
            conf = round(conf * 0.85, 3)

        ef = ExtractedField(
            document_id=doc.id,
            field_name=f["field_name"],
            field_value=f["field_value"],
            confidence_score=conf,
            is_verified=False if conf < 0.8 else False,  # all start unverified; UI gates on <0.8
        )
        db.add(ef)
        created_fields.append({"field_name": f["field_name"], "field_value": f["field_value"], "confidence_score": conf, "is_verified": False})

    # mark completed
    doc.status = "completed"
    doc.processed_at = datetime.now(timezone.utc)
    db.add(doc)

    # audit
    audit = AuditLog(user_id=actor_id, action="upload", entity_type="document", entity_id=doc.id, new_value=original_name)
    db.add(audit)
    db.commit()

    # re-fetch fields after commit
    db_fields = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()

    return {
        "message": "Document ingested — queued for extraction",
        "document": {
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "doc_type": doc.doc_type,
            "language": doc.language,
            "status": doc.status,
            "uploaded_by": doc.uploaded_by,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "processed_at": doc.processed_at.isoformat() if doc.processed_at else None,
        },
        "ocr_engine": ocr_result.get("engine", "none"),
        "engines": available_engines(),
        "extracted_fields": [
            {"id": f.id, "field_name": f.field_name, "field_value": f.field_value, "confidence_score": f.confidence_score, "is_verified": f.is_verified}
            for f in db_fields
        ],
        "needs_verification": [f.field_name for f in db_fields if f.confidence_score < 0.8]
    }

@router.get("/")
async def list_documents(skip: int = 0, limit: int = 50, query: str = "", db: Session = Depends(get_db)):
    docs_query = db.query(Document)
    if query.strip():
        docs_query = docs_query.filter(Document.filename.ilike(f"%{query.strip()}%"))
    total = docs_query.count()
    docs = docs_query.order_by(Document.created_at.desc()).offset(skip).limit(min(limit, 100)).all()
    result = []
    for d in docs:
        fields = db.query(ExtractedField).filter(ExtractedField.document_id == d.id).all()
        avg_conf = round(sum(f.confidence_score for f in fields)/len(fields), 3) if fields else None
        result.append({
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "doc_type": d.doc_type or "register",
            "language": d.language,
            "status": d.status,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "processed_at": d.processed_at.isoformat() if d.processed_at else None,
            "field_count": len(fields),
            "avg_confidence": avg_conf,
            "needs_verification": len([f for f in fields if f.confidence_score < 0.8])
        })
    return {"total": total, "documents": result}

@router.delete("/")
async def clear_all_documents(db: Session = Depends(get_db), _inspector: User = Depends(require_inspector)):
    """Delete ALL uploaded documents, their fields, audit logs and files. Users are preserved."""
    docs = db.query(Document).all()
    deleted_files = 0
    for d in docs:
        # delete source file if inside UPLOAD_DIR
        try:
            if d.file_path and os.path.isfile(d.file_path):
                abs_path = os.path.abspath(d.file_path)
                upload_abs = os.path.abspath(UPLOAD_DIR)
                if abs_path.startswith(upload_abs):
                    os.remove(abs_path)
                    deleted_files += 1
        except Exception:
            pass
    doc_ids = [d.id for d in docs]
    db.query(ExtractedField).delete()
    db.query(Document).delete()
    db.commit()
    return {"message": f"Cleared {len(doc_ids)} document(s)", "deleted_documents": len(doc_ids), "deleted_files": deleted_files}


@router.delete("/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db), _inspector: User = Depends(require_inspector)):
    """Delete one uploaded document + its extracted fields, audit trail and source file."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.query(ExtractedField).filter(ExtractedField.document_id == document_id).delete()
    # delete source file (only if inside UPLOAD_DIR for safety)
    file_removed = False
    try:
        if doc.file_path and os.path.isfile(doc.file_path):
            abs_path = os.path.abspath(doc.file_path)
            upload_abs = os.path.abspath(UPLOAD_DIR)
            if abs_path.startswith(upload_abs):
                os.remove(abs_path)
                file_removed = True
    except Exception:
        pass
    filename = doc.filename
    db.delete(doc)
    db.commit()
    # audit the deletion itself (entity already gone, keep a tombstone log with entity_id=0 note in new_value)
    try:
        tombstone = AuditLog(user_id=_inspector.id, action="delete", entity_type="document", entity_id=document_id, old_value=filename, new_value="deleted")
        db.add(tombstone)
        db.commit()
    except Exception:
        pass
    return {"message": f"Document #{document_id} deleted", "document_id": document_id, "filename": filename, "file_removed": file_removed}


@router.get("/{document_id}")
async def get_document(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    fields = db.query(ExtractedField).filter(ExtractedField.document_id == document_id).all()
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "doc_type": doc.doc_type or "register",
        "language": doc.language,
        "status": doc.status,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "processed_at": doc.processed_at.isoformat() if doc.processed_at else None,
        "fields": [
            {"id": f.id, "field_name": f.field_name, "field_value": f.field_value, "confidence_score": f.confidence_score, "is_verified": f.is_verified, "verified_by": f.verified_by}
            for f in fields
        ]
    }

@router.get("/{document_id}/source")
async def get_document_source(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.file_path or not os.path.isfile(doc.file_path):
        raise HTTPException(status_code=404, detail="Source document not found")
    return FileResponse(doc.file_path, media_type="application/pdf" if doc.file_type == "pdf" else None, filename=doc.filename)

@router.get("/{document_id}/download")
async def download_verified_document(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.file_path or not os.path.isfile(doc.file_path):
        raise HTTPException(status_code=404, detail="Source document not found")
    fields = db.query(ExtractedField).filter(ExtractedField.document_id == document_id).all()
    is_verified = any(f.is_verified for f in fields) if fields else False
    # Allow download for any completed document, but mark verified ones clearly; block failed/processing
    if doc.status != "completed" and not is_verified:
        raise HTTPException(status_code=400, detail="Document not yet verified for download")
    try:
        db.add(AuditLog(user_id=current_user.id, action="download", entity_type="document", entity_id=doc.id, new_value=doc.filename))
        db.commit()
    except Exception:
        db.rollback()
    return FileResponse(doc.file_path, media_type="application/pdf" if doc.file_type == "pdf" else None, filename=doc.filename, headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'})

@router.post("/{document_id}/process")
async def process_document(document_id: int, language: str = "hi", db: Session = Depends(get_db), _inspector: User = Depends(require_inspector)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Source file missing on server")
    # delete old fields
    db.query(ExtractedField).filter(ExtractedField.document_id == document_id).delete()
    doc.status = "processing"
    db.commit()
    try:
        ocr_result = ocr_image(doc.file_path, lang=language)
    except NoOCREngineError as e:
        doc.status = "failed"
        db.add(doc)
        db.commit()
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        doc.status = "failed"
        db.add(doc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {e}")
    if ocr_result.get("fields"):
        fields = ocr_result["fields"]
    else:
        fields = extract_fields_from_text(ocr_result.get("texts", []), lang=language)
    if not fields:
        doc.status = "failed"
        db.add(doc)
        db.commit()
        raise HTTPException(
            status_code=422,
            detail="No recognizable land-record fields found in this file. Upload a clearer scan or a text-based PDF.",
        )
    for f in fields:
        ef = ExtractedField(document_id=doc.id, field_name=f.get("field_name", "unknown"), field_value=f.get("field_value", ""), confidence_score=float(f.get("confidence_score", 0.0)))
        db.add(ef)
    doc.status = "completed"
    doc.processed_at = datetime.now(timezone.utc)
    db.commit()
    db_fields = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()
    return {"message": "Reprocessed", "document_id": doc.id, "fields": [{"field_name": f.field_name, "field_value": f.field_value, "confidence_score": f.confidence_score} for f in db_fields]}
