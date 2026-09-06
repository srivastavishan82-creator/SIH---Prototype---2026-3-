from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, List, Optional
from app.validation import validate_field, compute_confidence

router = APIRouter()

class FieldIn(BaseModel):
    field_name: str
    field_value: Any
    confidence: float = 0.0

class ValidateIn(BaseModel):
    fields: List[FieldIn]

@router.post("/validate")
async def validate_fields(payload: ValidateIn):
    results = []
    for f in payload.fields:
        v = validate_field(f.field_name, f.field_value)
        conf = compute_confidence(f.field_name, f.confidence)
        results.append({
            "field_name": f.field_name,
            "field_value": f.field_value,
            "is_valid": v["is_valid"],
            "errors": v["errors"],
            "confidence": conf,
            "needs_verification": conf < 0.8
        })
    return {"results": results, "needs_verification_count": len([r for r in results if r["needs_verification"]])}

@router.post("/confidence")
async def compute_confidence_endpoint(payload: ValidateIn):
    scores = [{"field_name": f.field_name, "confidence": compute_confidence(f.field_name, f.confidence)} for f in payload.fields]
    avg = round(sum(s["confidence"] for s in scores)/len(scores), 3) if scores else 0
    return {"scores": scores, "average_confidence": avg, "gate": "pass" if avg >= 0.8 else "review"}
