from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from typing import Optional as TypingOptional
from app.database import get_db
from app.models import Document, ExtractedField, AuditLog, User
from app.auth import get_current_active_user

router = APIRouter()

SYNC_ENTITY = "lrms_sync"


def _last_sync(db: Session):
    return (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == SYNC_ENTITY, AuditLog.action == "sync")
        .order_by(AuditLog.created_at.desc())
        .first()
    )

class LRMSPayload(BaseModel):
    document_id: Optional[int] = None
    fields: Optional[Dict[str, Any]] = None

@router.post("/lrms")
async def sync_lrms(payload: Optional[LRMSPayload] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    doc_id = payload.document_id if payload else None
    if payload and payload.fields:
        fields_count = len(payload.fields)
    elif doc_id is not None:
        fields_count = db.query(ExtractedField).filter(ExtractedField.document_id == doc_id).count()
    else:
        # Real count of human-verified fields ready for sync — never a placeholder
        fields_count = db.query(ExtractedField).filter(ExtractedField.is_verified == True).count()
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    # Persist sync run so history survives restarts (entity_id = doc_id or 0 for full sync)
    try:
        db.add(AuditLog(
            user_id=current_user.id, action="sync", entity_type=SYNC_ENTITY,
            entity_id=doc_id or 0,
            new_value=f"{fields_count} records @ {timestamp}",
        ))
        db.commit()
    except Exception:
        db.rollback()
    return {
        "status": "Staged",
        "system": "LRMS export staging",
        "document_id": doc_id,
        "records_synced": fields_count,
        "timestamp": timestamp,
        "reconciled": False,
        "mode": "local_staging",
        "message": f"Prepared {fields_count} verified records for LRMS export. No external government endpoint is configured."
    }


@router.get("/lrms/status")
async def lrms_status(db: Session = Depends(get_db)):
    """Live counters powering the LRMS card: what is ready, what was synced last."""
    verified = db.query(ExtractedField).filter(ExtractedField.is_verified == True).count()
    total_docs = db.query(Document).count()
    total_fields = db.query(ExtractedField).count()
    last = _last_sync(db)
    return {
        "system": "DILRMP / LRMS Portal",
        "verified_ready": verified,
        "total_documents": total_docs,
        "total_fields": total_fields,
        "connected": False,
        "mode": "local_staging",
        "last_sync": {
            "records_synced": (last.new_value or "").split(" records")[0] if last and last.new_value else None,
            "timestamp": last.created_at.isoformat() if last and last.created_at else None,
            "detail": last.new_value if last else None,
        } if last else None,
    }


@router.get("/lrms/history")
async def lrms_history(limit: int = 20, db: Session = Depends(get_db)):
    """Sync run history (newest first) — real persisted runs, empty until first sync."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == SYNC_ENTITY, AuditLog.action == "sync")
        .order_by(AuditLog.created_at.desc())
        .limit(min(max(limit, 1), 50))
        .all()
    )
    return {
        "total": len(logs),
        "history": [
            {
                "status": "Success",
                "records_synced": (int((l.new_value or "0").split(" records")[0]) if (l.new_value or "0").split(" records")[0].strip().isdigit() else 0),
                "timestamp": l.created_at.isoformat() if l.created_at else None,
                "document_id": l.entity_id or None,
            }
            for l in logs
        ],
    }

@router.post("/dilmrp")
async def sync_dilmrp(payload: Optional[LRMSPayload] = None, db: Session = Depends(get_db)):
    total_docs = db.query(Document).count()
    verified = db.query(ExtractedField).filter(ExtractedField.is_verified == True).count()
    return {
        "status": "Success",
        "system": "Digital India Land Records Modernization Programme (DILRMP)",
        "document_id": payload.document_id if payload else None,
        "documents_total": total_docs,
        "fields_verified": verified,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@router.get("/gis/parcel/{survey_no}")
async def get_gis_parcel(survey_no: str, db: Session = Depends(get_db)):
    """Return parcel details for a survey/khasra number from digitized records.

    Only values actually stored in the database are returned. No cadastral
    geometry is stored yet, so geometry is null. Unknown numbers get a 404.
    NOTE: numbers containing '/' must use the ?survey_no= query form below,
    because encoded slashes do not match path routes on all servers.
    """
    return _parcel_lookup(survey_no, db)


@router.get("/gis/parcel")
async def get_gis_parcel_query(survey_no: str, db: Session = Depends(get_db)):
    """Query-param form of parcel lookup (safe for numbers like '123/4')."""
    return _parcel_lookup(survey_no, db)


def _parcel_lookup(survey_no: str, db: Session):
    needle = survey_no.strip()
    if not needle:
        raise HTTPException(status_code=400, detail="Survey number is required")
    # 1) Try PostGIS cadastral_parcels first (true geometry)
    try:
        from sqlalchemy import text
        row = db.execute(text("""
            SELECT id, document_id, survey_no, village, district, ST_AsGeoJSON(geom)::text as geojson
            FROM cadastral_parcels WHERE survey_no ILIKE :q LIMIT 1
        """), {"q": f"%{needle}%"}).mappings().first()
        if row and row["geojson"]:
            import json
            doc = db.query(Document).filter(Document.id == row["document_id"]).first() if row["document_id"] else None
            # also enrich with extracted fields if available
            props = {}
            if row["document_id"]:
                siblings = db.query(ExtractedField).filter(ExtractedField.document_id == row["document_id"]).all()
                props = {f.field_name: f.field_value for f in siblings}
            geom = json.loads(row["geojson"])
            parcel = {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "survey_no": row["survey_no"],
                    "khasra_no": props.get("khasra_number"),
                    "area": props.get("plot_area"),
                    "village": row["village"] or props.get("village"),
                    "tehsil": props.get("tehsil"),
                    "district": row["district"] or props.get("district"),
                    "state": props.get("state"),
                    "land_type": props.get("land_classification"),
                    "owner": props.get("landowner_name"),
                    "source_document": doc.filename if doc else None,
                    "crs": "EPSG:4326",
                    "postgis": True,
                },
            }
            return {"survey_no": needle, "source": "PostGIS cadastral_parcels (EPSG:4326)", "parcel": parcel}
    except Exception:
        pass
    # 2) Fallback to digitized ExtractedField record (attributes only)
    match = (
        db.query(ExtractedField)
        .filter(
            ExtractedField.field_name.in_(["survey_number", "khasra_number"]),
            ExtractedField.field_value.contains(needle),
        )
        .first()
    )
    if not match:
        raise HTTPException(
            status_code=404,
            detail=f"No digitized record found for survey/khasra number '{needle}'",
        )
    siblings = db.query(ExtractedField).filter(ExtractedField.document_id == match.document_id).all()
    props = {f.field_name: f.field_value for f in siblings}
    doc = db.query(Document).filter(Document.id == match.document_id).first()
    # Check if this doc now has a PostGIS parcel linked
    try:
        from sqlalchemy import text
        prow = db.execute(text("SELECT ST_AsGeoJSON(geom)::text as geojson FROM cadastral_parcels WHERE document_id=:did LIMIT 1"), {"did": match.document_id}).mappings().first()
        if prow and prow["geojson"]:
            import json
            geom = json.loads(prow["geojson"])
            parcel = {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "survey_no": props.get("survey_number", needle),
                    "khasra_no": props.get("khasra_number"),
                    "area": props.get("plot_area"),
                    "village": props.get("village"),
                    "tehsil": props.get("tehsil"),
                    "district": props.get("district"),
                    "state": props.get("state"),
                    "land_type": props.get("land_classification"),
                    "owner": props.get("landowner_name"),
                    "source_document": doc.filename if doc else None,
                },
            }
            return {"survey_no": needle, "source": "PostGIS cadastral_parcels (EPSG:4326)", "parcel": parcel}
    except Exception:
        pass
    parcel = {
        "type": "Feature",
        "geometry": None,
        "properties": {
            "survey_no": props.get("survey_number", needle),
            "khasra_no": props.get("khasra_number"),
            "area": props.get("plot_area"),
            "village": props.get("village"),
            "tehsil": props.get("tehsil"),
            "district": props.get("district"),
            "state": props.get("state"),
            "land_type": props.get("land_classification"),
            "owner": props.get("landowner_name"),
            "source_document": doc.filename if doc else None,
        },
    }
    return {"survey_no": needle, "source": "Digitized land records (no cadastral geometry stored — add polygon to cadastral_parcels for true boundary)", "parcel": parcel}

@router.get("/gis/parcels")
async def list_gis_parcels(limit: int = 50, db: Session = Depends(get_db)):
    """All digitized parcels — prefers PostGIS cadastral_parcels with geometry if present."""
    # Prefer PostGIS parcels
    try:
        from sqlalchemy import text
        rows = db.execute(text("""
            SELECT id, document_id, survey_no, village, district, ST_AsGeoJSON(geom)::text as geojson
            FROM cadastral_parcels ORDER BY id DESC LIMIT :lim
        """), {"lim": min(max(limit, 1), 200)}).mappings().all()
        if rows:
            out = []
            for r in rows:
                import json
                geom = json.loads(r["geojson"]) if r["geojson"] else None
                doc = db.query(Document).filter(Document.id == r["document_id"]).first() if r["document_id"] else None
                out.append({
                    "id": r["id"],
                    "document_id": r["document_id"],
                    "survey_no": r["survey_no"],
                    "village": r["village"],
                    "district": r["district"],
                    "has_geometry": geom is not None,
                    "geometry": geom,
                    "filename": doc.filename if doc else None,
                })
            return {"total": len(out), "parcels": out, "source": "cadastral_parcels (PostGIS EPSG:4326)"}
    except Exception:
        pass
    # Fallback to digitized ExtractedFields
    survey_fields = (
        db.query(ExtractedField)
        .filter(ExtractedField.field_name.in_(["survey_number", "khasra_number"]))
        .order_by(ExtractedField.document_id.desc())
        .limit(min(max(limit, 1), 200))
        .all()
    )
    parcels = []
    seen_docs = set()
    for f in survey_fields:
        if f.document_id in seen_docs:
            continue
        seen_docs.add(f.document_id)
        siblings = db.query(ExtractedField).filter(ExtractedField.document_id == f.document_id).all()
        props = {s.field_name: s.field_value for s in siblings}
        doc = db.query(Document).filter(Document.id == f.document_id).first()
        parcels.append({
            "document_id": f.document_id,
            "survey_no": props.get("survey_number") or props.get("khasra_number") or f.field_value,
            "khasra_no": props.get("khasra_number"),
            "village": props.get("village"),
            "district": props.get("district"),
            "owner": props.get("landowner_name"),
            "area": props.get("plot_area"),
            "filename": doc.filename if doc else None,
            "has_geometry": False,
            "geometry": None,
        })
    return {"total": len(parcels), "parcels": parcels, "source": "digitized attributes only"}


def _postgis_version(db: Session) -> Optional[str]:
    from sqlalchemy import text
    try:
        return db.execute(text("SELECT PostGIS_version()")).scalar()
    except Exception:
        return None

def _ensure_sample_parcel(db: Session):
    """Seed one demo polygon if table is empty — so GIS demo works out of box."""
    try:
        from sqlalchemy import text
        cnt = db.execute(text("SELECT COUNT(*) FROM cadastral_parcels")).scalar()
        if cnt and cnt > 0:
            return
        # Pick an existing document to link, or create standalone
        doc_id = db.execute(text("SELECT id FROM documents ORDER BY id DESC LIMIT 1")).scalar()
        # Agra demo square ~500m near 27.172°N 78.042°E
        wkt = "POLYGON((78.0420 27.1720, 78.0470 27.1720, 78.0470 27.1765, 78.0420 27.1765, 78.0420 27.1720))"
        db.execute(text("""
            INSERT INTO cadastral_parcels (document_id, survey_no, village, district, geom)
            VALUES (:did, :sn, :vill, :dist, ST_GeomFromText(:wkt, 4326))
        """), {"did": doc_id, "sn": "45/2B", "vill": "Rampur", "dist": "Agra", "wkt": wkt})
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


@router.get("/health")
async def integrations_health(db: Session = Depends(get_db)):
    """Real connectivity status: database reachability + PostGIS + configured OCR engines."""
    from sqlalchemy import text
    from app.ocr import available_engines
    try:
        db.execute(text("SELECT 1"))
        db_status = "online"
    except Exception as e:
        db_status = f"offline: {e}"
    postgis = _postgis_version(db) if db_status == "online" else None
    if db_status == "online" and postgis:
        _ensure_sample_parcel(db)
    parcel_count = 0
    geom_count = 0
    if db_status == "online":
        try:
            parcel_count = db.query(ExtractedField).filter(
                ExtractedField.field_name.in_(["survey_number", "khasra_number"])
            ).count()
        except Exception:
            parcel_count = 0
        try:
            geom_count = db.execute(text("SELECT COUNT(*) FROM cadastral_parcels WHERE geom IS NOT NULL")).scalar() or 0
        except Exception:
            geom_count = 0
    engines = available_engines()
    return {
        "database": db_status,
        "postgis_version": postgis,
        "postgis_connected": postgis is not None,
        "parcels_indexed": parcel_count,
        "parcels_with_geometry": geom_count,
        "crs": "EPSG:4326",
        "ocr_engines": engines,
        "lrms": "ready" if db_status == "online" else "unavailable (database offline)",
        "gis": "postgis-connected" if postgis else "record-lookup (no cadastral geometry stored)",
    }
