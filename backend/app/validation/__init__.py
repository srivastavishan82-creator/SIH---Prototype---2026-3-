"""Rule-based revenue validation for extracted land record fields."""

import re
from typing import Any, Dict

KHASRA_REGEX = re.compile(r"^\d+([/-]\d+[A-Za-z]*)?$")
AREA_NUMERIC_REGEX = re.compile(r"(\d+(?:\.\d+)?)")

def validate_field(field_name: str, value: Any) -> Dict[str, Any]:
    """Validate land record field according to revenue rules."""
    result = {"is_valid": True, "errors": []}
    if value is None or str(value).strip() == "":
        result["is_valid"] = False
        result["errors"].append(f"{field_name} is missing or empty")
        return result

    val_str = str(value).strip()

    if field_name == "plot_area":
        # Extract numeric component from strings like '2.45 hectares', '5 Bigha'
        match = AREA_NUMERIC_REGEX.search(val_str)
        if not match:
            result["is_valid"] = False
            result["errors"].append("Area must contain a valid numeric value")
        else:
            try:
                area_val = float(match.group(1))
                if area_val <= 0:
                    result["is_valid"] = False
                    result["errors"].append("Plot area must be greater than zero")
                elif area_val > 100000:
                    result["is_valid"] = False
                    result["errors"].append("Area exceeds realistic parcel bounds")
            except ValueError:
                result["is_valid"] = False
                result["errors"].append("Invalid area number format")

    elif field_name in ("khasra_number", "survey_number", "khata_number"):
        # Match common revenue numbering formats (e.g. 123, 123/4, 45/2B, 102-A)
        clean_no = re.sub(r"[^\w/-]", "", val_str)
        if len(clean_no) < 1 or not KHASRA_REGEX.match(clean_no):
            result["is_valid"] = False
            result["errors"].append("Invalid Khasra/Survey/Khata number format")

    elif field_name == "landowner_name":
        if len(val_str) < 2:
            result["is_valid"] = False
            result["errors"].append("Landowner name too short")

    elif field_name in ("village", "tehsil", "district"):
        if len(val_str) < 2:
            result["is_valid"] = False
            result["errors"].append(f"Invalid {field_name} name")

    return result

def compute_confidence(field_name: str, ocr_conf: float) -> float:
    """Compute normalized confidence score."""
    score = float(ocr_conf) if ocr_conf is not None else 0.85
    return round(min(0.99, max(0.40, score)), 3)

