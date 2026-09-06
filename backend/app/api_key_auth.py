from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import APIKey, verify_api_key

async def get_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> APIKey:
    if not x_api_key or len(x_api_key) < 12:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    # Support both legacy 8-char and new 12-char prefixes
    candidates = db.query(APIKey).filter(APIKey.is_active == True).all()
    # Fast path: try 12-char then 8-char prefix lookup
    key = None
    for plen in (12, 8):
        prefix = x_api_key[:plen]
        key = db.query(APIKey).filter(APIKey.prefix == prefix, APIKey.is_active == True).first()
        if key and verify_api_key(x_api_key, key.key_hash):
            break
        key = None
    if not key:
        # Fallback scan for legacy keys (prefix collisions possible with old 8-char scheme)
        for c in candidates:
            try:
                if verify_api_key(x_api_key, c.key_hash):
                    key = c
                    break
            except Exception:
                continue
    if not key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    key.last_used_at = datetime.now(timezone.utc)
    db.add(key)
    db.commit()
    db.refresh(key)
    return key
