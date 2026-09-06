import os
import shutil
import tempfile
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.ocr import ocr_image, extract_fields_from_text, NoOCREngineError

router = APIRouter()

def _safe_tmp_path(filename: str | None) -> str:
    safe = os.path.basename(filename or "upload.bin")
    # Avoid path traversal / absolute paths; keep extension
    safe = safe.replace("\x00", "")[:120] or "upload.bin"
    tmpdir = tempfile.gettempdir()
    return os.path.join(tmpdir, f"{uuid.uuid4().hex}_{safe}")

@router.post("/ocr")
async def run_ocr(file: UploadFile = File(...), lang: str = Form("en")):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    tmp = _safe_tmp_path(file.filename)
    with open(tmp, "wb") as out:
        shutil.copyfileobj(file.file, out)
    try:
        try:
            result = ocr_image(tmp, lang=lang)
        except NoOCREngineError as e:
            raise HTTPException(status_code=422, detail=str(e))
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except:
                pass
    return {"filename": file.filename, "engine": result.get("engine"), "texts": result.get("texts")}

@router.post("/extract-fields")
async def extract_fields(file: UploadFile = File(...), lang: str = Form("en")):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    tmp = _safe_tmp_path(file.filename)
    with open(tmp, "wb") as out:
        shutil.copyfileobj(file.file, out)
    try:
        try:
            ocr_res = ocr_image(tmp, lang=lang)
        except NoOCREngineError as e:
            raise HTTPException(status_code=422, detail=str(e))
        fields = extract_fields_from_text(ocr_res.get("texts", []), lang=lang)
        if not fields:
            raise HTTPException(
                status_code=422,
                detail="No recognizable land-record fields found in this file.",
            )
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except:
                pass
    return {"filename": file.filename, "engine": ocr_res.get("engine"), "fields": fields}
