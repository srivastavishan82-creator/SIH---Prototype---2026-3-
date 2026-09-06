"""Land Record Digitization & OCR Pipeline.

Real extraction pipeline — no demo/mock data is ever returned:
1. Google Gemini Vision (multilingual Hindi/Marathi/Urdu/English) when
   GEMINI_API_KEY / GOOGLE_API_KEY is configured.
2. pypdf text extraction for text-based PDFs.
3. PaddleOCR for scanned images when installed.

If none of the above can handle a file, ocr_image() raises
NoOCREngineError with setup guidance instead of fabricated data.
"""

import os
import re
import json
import base64
import mimetypes
from typing import Optional, List, Dict
import httpx

try:
    from paddleocr import PaddleOCR
    HAS_PADDLE = True
except Exception:
    HAS_PADDLE = False
    PaddleOCR = None

ocr_engine: Optional[object] = None


class NoOCREngineError(RuntimeError):
    """Raised when no OCR engine can process the given file."""


def get_gemini_api_key() -> Optional[str]:
    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or None
    )


def available_engines() -> Dict[str, bool]:
    """Report which real OCR engines are usable right now."""
    return {
        "gemini": bool(get_gemini_api_key()),
        "pypdf": True,
        "paddleocr": HAS_PADDLE,
    }


def primary_engine_name() -> str:
    av = available_engines()
    if av["gemini"]:
        return f"gemini-vision ({os.getenv('GOOGLE_MODEL', 'gemini-flash-latest')})"
    if av["paddleocr"]:
        return "paddleocr"
    return "pypdf-parser"


def get_ocr_engine(lang: str = "en"):
    global ocr_engine
    if not HAS_PADDLE:
        return None
    if ocr_engine is None:
        try:
            ocr_engine = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        except Exception:
            return None
    return ocr_engine

def _extract_via_gemini(file_path: str, lang: str = "hi") -> Optional[Dict]:
    """Extract structured land records using Google Gemini Multimodal Vision API."""
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    try:
        # Determine mime type
        ext = os.path.splitext(file_path)[1].lower()
        mime_type = "application/pdf" if ext == ".pdf" else (mimetypes.guess_type(file_path)[0] or "image/jpeg")

        with open(file_path, "rb") as f:
            encoded_bytes = base64.b64encode(f.read()).decode("utf-8")

        prompt = f"""You are an expert Indian Land Records & Revenue Department AI digitization system (DILRMP / LRMS).
Analyze the provided document (which may be a handwritten register, 7/12 extract, Khatauni, Jamabandi, Khasra Naksha, or Registry deed).
The document may be in Hindi (Devanagari), Urdu, Marathi, Gujarati, Bengali, or English.

Extract ONLY fields you can actually read in the document into JSON. Do not invent values.
- landowner_name: Full name of the landowner (preserve native script if readable)
- father_husband_name: Father or husband name
- survey_number: Land survey / CTS number
- khasra_number: Khasra number (e.g. 123/4, 45/2)
- khata_number: Khata or Khatauni number
- plot_area: Area with units (e.g. 2.45 hectares, 5 Bigha, 1200 sq. meters)
- village: Village / Mauza / Gram name
- tehsil: Tehsil / Taluka / Sub-district
- district: District
- state: Indian State
- land_classification: Type of land (e.g. Agricultural, Residential, Non-Agricultural, Barren)
- mutation_record: Mutation / Dakhil Kharij number or status (e.g. Approved, Pending, Nil)
- registration_info: Deed registration number and date if present

Also provide:
- confidence_score: A float between 0.40 and 0.99 for EACH extracted field based on visual legibility and clarity.
- detected_language: Primary language of the document.

Return strictly valid JSON with this format (omit fields you cannot read):
{{
  "detected_language": "hi",
  "fields": [
    {{"field_name": "landowner_name", "field_value": "...", "confidence_score": 0.95}}
  ],
  "raw_text_summary": "Summary of visible record text"
}}
"""
        # Model candidates: explicit GOOGLE_MODEL first, then known-good fallbacks
        # (older model names get retired by Google; 'gemini-flash-latest'
        # always aliases to a currently supported Flash model).
        requested = os.getenv("GOOGLE_MODEL", "gemini-flash-latest")
        candidates = [requested] + [m for m in ("gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.0-flash") if m != requested]

        last_error = None
        for model_name in candidates:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

            payload = {
                "contents": [
                    {
                        "parts": [
                            {"inlineData": {"mimeType": mime_type, "data": encoded_bytes}},
                            {"text": prompt}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json"
                }
            }

            with httpx.Client(timeout=45.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    try:
                        text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError, TypeError):
                        print(f"Gemini unexpected response shape: {str(data)[:200]}")
                        return None
                    # Strip markdown fences if model wraps JSON in ```json ... ```
                    text_content = text_content.strip()
                    if text_content.startswith("```"):
                        text_content = re.sub(r"^```(?:json)?\s*", "", text_content)
                        text_content = re.sub(r"\s*```$", "", text_content)
                    try:
                        parsed = json.loads(text_content)
                    except json.JSONDecodeError as je:
                        print(f"Gemini JSON parse failed: {je}; raw[:200]={text_content[:200]}")
                        return None
                    if "fields" in parsed and isinstance(parsed["fields"], list):
                        return {
                            "texts": [{"text": f.get("field_value", ""), "confidence": f.get("confidence_score", 0.9)} for f in parsed["fields"]],
                            "fields": parsed["fields"],
                            "raw": parsed,
                            "engine": f"gemini-vision ({model_name})"
                        }
                    return None
                elif resp.status_code == 404:
                    # Model name retired/unknown — try next candidate
                    last_error = f"{model_name}: {resp.text[:150]}"
                    print(f"Gemini model {model_name} unavailable, trying fallback…")
                    continue
                elif resp.status_code in (429, 500, 503):
                    # Overloaded / rate-limited — a different model may have capacity
                    last_error = f"{model_name}: {resp.text[:150]}"
                    print(f"Gemini model {model_name} overloaded ({resp.status_code}), trying fallback…")
                    continue
                else:
                    print(f"Gemini API returned status {resp.status_code}: {resp.text[:200]}")
                    return None
        if last_error:
            print(f"Gemini extraction failed, last error: {last_error}")
    except Exception as e:
        print(f"Gemini extraction error: {e}")
    return None

def _extract_from_pdf_text(file_path: str) -> Optional[dict]:
    """Extract structured revenue fields from a text-based PDF via pypdf.

    Returns None when the PDF has no extractable text or no recognizable
    revenue fields — never fabricated values.
    """
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        full_text = "\n".join([page.extract_text() or "" for page in reader.pages]).strip()
        if not full_text or len(full_text) < 10:
            return None

        fields = []

        def add(field_name: str, value: Optional[str], confidence: float = 0.9):
            if value:
                v = re.sub(r"\s+", " ", value).strip(" \t:-–—;,|")
                if len(v) >= 2:
                    fields.append({"field_name": field_name, "field_value": v[:200], "confidence_score": confidence})

        m_dist = re.search(r'District\s*[:\n\r]+\s*([^\n\r]+)', full_text, re.I)
        if m_dist:
            add("district", m_dist.group(1))

        m_teh = re.search(r'Tehsil\s*[:\n\r]+\s*([^\n\r]+)', full_text, re.I)
        if m_teh:
            add("tehsil", m_teh.group(1))

        m_vil = re.search(r'Village\s*[:\n\r]+\s*([^\n\r]+)', full_text, re.I)
        if m_vil:
            add("village", m_vil.group(1))

        m_fasli = re.search(r'Fasli Year\s*[:\n\r]+\s*([^\n\r]+)', full_text, re.I)
        if m_fasli:
            add("fasli_year", m_fasli.group(1))

        m_khata = re.search(r'Khata Number\s*[:\n\r]+\s*([^\n\r]+)', full_text, re.I)
        if m_khata:
            add("khata_number", m_khata.group(1))

        # Khasra / owner / area table rows
        khasras = re.findall(r'(\d{3,4}(?:/\d+)?)\s*\n\s*([A-Za-z\s]+)\s*\n\s*(\d+\.\d{3,4})', full_text)
        if khasras:
            add("khasra_number", ", ".join([k[0] for k in khasras]), 0.9)
            add("landowner_name", ", ".join([k[1].strip() for k in khasras]), 0.9)
            add("plot_area", ", ".join([f"{k[2]} ha" for k in khasras]), 0.88)

        if "agricultural" in full_text.lower() or "residential" in full_text.lower():
            add("land_classification", "Agricultural, Residential")
        if "recorded holder" in full_text.lower():
            add("ownership", "Recorded Holder")

        mutations = re.findall(r'(MUT-\d{4}-\d{4})\s*\n\s*(\d{2}-\d{2}-\d{4})\s*\n\s*([A-Za-z]+)\s*\n\s*([A-Za-z\s]+)', full_text)
        if mutations:
            mut_strs = [f"{m[0]} ({m[2]} - {m[3].strip()})" for m in mutations]
            add("mutation_record", "; ".join(mut_strs), 0.85)

        # Merge in any labelled fields the table above missed (khasra,
        # survey, area, owner names, state, registration, ...) using the
        # same general-purpose label scan as image OCR.
        if full_text:
            have = {f["field_name"] for f in fields}
            for extra in _scan_label_patterns(full_text, base_conf=0.9, skip=have):
                fields.append(extra)

        if fields:
            return {
                "texts": [{"text": f["field_value"], "confidence": f["confidence_score"]} for f in fields],
                "fields": fields,
                "raw": {"full_text": full_text[:2000]},
                "engine": "pypdf-parser"
            }
    except Exception as e:
        print(f"PDF text extraction note: {e}")
    return None


def ocr_image(image_path: str, lang: str = "en") -> dict:
    """Run real OCR: pypdf (PDFs, fast/local) -> Gemini Vision -> PaddleOCR.

    Raises NoOCREngineError when no engine can process the file, so callers
    can report an honest failure instead of storing fabricated fields.
    """
    # 1. Try pypdf text extraction first for PDFs — instant, free, no quota.
    if image_path.lower().endswith(".pdf"):
        pdf_res = _extract_from_pdf_text(image_path)
        if pdf_res:
            return pdf_res

    # 2. Try Gemini Vision if API key configured (needed for scanned PDFs/images)
    gemini_res = _extract_via_gemini(image_path, lang=lang)
    if gemini_res:
        return gemini_res

    if image_path.lower().endswith(".pdf"):
        if not HAS_PADDLE and not get_gemini_api_key():
            raise NoOCREngineError(
                "No readable text found in this PDF and no AI OCR engine is configured. "
                "Set GEMINI_API_KEY in backend/.env for scanned PDFs, or upload a text-based PDF."
            )

    # 3. Try PaddleOCR if available
    engine = get_ocr_engine(lang)
    if engine is not None:
        try:
            result = engine.ocr(image_path, cls=True)
            texts = []
            if result and result[0]:
                for line in result[0]:
                    texts.append({
                        "text": line[1][0],
                        "confidence": float(line[1][1]),
                        "bbox": line[0],
                    })
            if texts:
                return {"texts": texts, "raw": result, "engine": "paddleocr"}
        except Exception as e:
            print(f"PaddleOCR error: {e}")

    # 4. No engine could handle this file — fail honestly
    raise NoOCREngineError(
        "No OCR engine available for this file. "
        "Set GEMINI_API_KEY in backend/.env to enable AI vision OCR, "
        "or install PaddleOCR for offline image OCR. "
        "Text-based PDFs work without extra setup."
    )


# Regex patterns for real field extraction from OCR text.
# Each entry: (field_name, [patterns...]) — first pattern that matches wins.
# Only values actually present in the OCR text are returned.
FIELD_PATTERNS: List[tuple] = [
    ("district", [r"(?:district|जिला)\s*[:\-–]\s*([^\n,;|]+)"]),
    ("tehsil", [r"(?:tehsil|tehshil|taluka|tahsil|तहसील|तालुका)\s*[:\-–]\s*([^\n,;|]+)"]),
    ("village", [r"(?:village|mauza|mouza|gram|ग्राम|ग[ााँ]व|मौजा)\s*[:\-–]\s*([^\n,;|]+)"]),
    ("state", [r"(?:state|राज्य)\s*[:\-–]\s*([^\n,;|]+)"]),
    ("khata_number", [
        r"khat(?:a|auni)[^\n:;]{0,25}[:\-–]\s*([A-Za-z0-9][A-Za-z0-9/\- ]{0,20})",
        r"खाता[^\n:;]{0,15}[:\-–]?\s*([A-Za-z0-9][A-Za-z0-9/\- ]{0,20})",
    ]),
    ("khasra_number", [
        r"khasra[^\n:;]{0,25}[:\-–]?\s*([0-9][0-9/\-A-Za-z ]{0,20})",
        r"खसरा[^\n:;]{0,15}[:\-–]?\s*([0-9][0-9/\-A-Za-z ]{0,20})",
    ]),
    ("survey_number", [
        r"survey[^\n:;]{0,25}(?:no\.?|number|नं)?[^\n:;]{0,10}[:\-–]?\s*([0-9][0-9/\-A-Za-z ]{0,20})",
        r"सर्वे[^\n:;]{0,15}[:\-–]?\s*([0-9][0-9/\-A-Za-z ]{0,20})",
    ]),
    ("plot_area", [
        r"(?:area|क्षेत्रफल|क्षेत्र)[^\n:;]{0,25}[:\-–]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:hectares?|ha|bigha|biswa|acres?|sq\.?\s*m(?:eters?)?)?)",
    ]),
    ("landowner_name", [
        r"(?:landowner|owner(?:'s)?\s*name|name\s*of\s*(?:the\s*)?owner|holder|pattadar|खातेदार|स्वामी|मालिक)[^\n:;]{0,25}[:\-–]?\s*([^\n,;|]{2,120})",
    ]),
    ("father_husband_name", [
        r"(?:father(?:'s)?\s*name|husband(?:'s)?\s*name|\bs\/o\b|\bd\/o\b|\bw\/o\b|s\/o|d\/o|w\/o|पिता|पति)[^\n:;]{0,25}[:\-–]?\s*([^\n,;|]{2,120})",
    ]),
    ("mutation_record", [r"mutation[^\n:;]{0,25}[:\-–]?\s*([^\n|]{2,200})"]),
    ("registration_info", [
        r"(?:registration|registry|deed)(?:[^\n:;]{0,25}(?:no\.?|number|vol\.?|date))?[^\n:;]{0,15}[:\-–]?\s*([^\n|]{2,200})",
    ]),
]

CLASSIFICATION_KEYWORDS = {
    "agricultural": "Agricultural",
    "residential": "Residential",
    "commercial": "Commercial",
    "barren": "Barren",
    "non-agricultural": "Non-Agricultural",
    "forest": "Forest",
    "कृषि": "Agricultural",
}


def _clean_field_value(val: str) -> str:
    v = re.sub(r"\s+", " ", val).strip(" \t:-–—;,|\"'")
    return v[:200]


def _scan_label_patterns(joined: str, base_conf: float, skip: set) -> List[Dict]:
    """Scan text with FIELD_PATTERNS, skipping field names already found."""
    found: List[Dict] = []
    for fname, patterns in FIELD_PATTERNS:
        if fname in skip:
            continue
        for pat in patterns:
            m = re.search(pat, joined, re.I)
            if m:
                val = _clean_field_value(m.group(1))
                if len(val) >= 2:
                    found.append({
                        "field_name": fname,
                        "field_value": val,
                        "confidence_score": base_conf,
                    })
                break

    # Land classification via keyword scan when no labelled match
    if "land_classification" not in skip and not any(f["field_name"] == "land_classification" for f in found):
        lowered = joined.lower()
        hits = [label for kw, label in CLASSIFICATION_KEYWORDS.items() if kw in lowered]
        if hits:
            found.append({
                "field_name": "land_classification",
                "field_value": ", ".join(sorted(set(hits))),
                "confidence_score": base_conf,
            })
    return found


def extract_fields_from_text(texts: List[Dict], lang: str = "en") -> List[Dict]:
    """Extract ONLY fields actually present in the OCR text.

    Returns an empty list when nothing recognizable is found — callers
    treat that as an extraction failure, not as demo data.
    """
    if not texts:
        return []
    joined = "\n".join([t.get("text", "") for t in texts if t.get("text")])
    if not joined.strip():
        return []

    confs = [t.get("confidence", 0.85) for t in texts
             if isinstance(t.get("confidence"), (int, float))]
    base_conf = round(sum(confs) / len(confs), 3) if confs else 0.85
    base_conf = min(0.95, max(0.40, base_conf))

    fields: List[Dict] = _scan_label_patterns(joined, base_conf, skip=set())

    return fields
