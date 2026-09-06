from fastapi import APIRouter
from app.api import auth, documents, ocr, validation, verification, analytics, integrations, api_keys

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["ocr"])
api_router.include_router(validation.router, prefix="/validation", tags=["validation"])
api_router.include_router(verification.router, prefix="/verification", tags=["verification"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["api-keys"])
