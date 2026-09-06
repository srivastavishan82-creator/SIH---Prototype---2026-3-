import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
except Exception:
    pass

from app.database import init_db, DATABASE_URL as RESOLVED_DB_URL
from app.api import auth, documents, ocr, validation, verification, analytics, integrations, api_keys
from app.api_key_auth import get_api_key
from app.auth import get_current_active_user, require_inspector

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create SQLite tables on startup - no PostgreSQL required
    try:
        init_db()
        print("Database initialized at", RESOLVED_DB_URL)
        # Seed default admin user if not exists
        from app.database import SessionLocal
        from app.models import User
        from app.auth import hash_password
        db = SessionLocal()
        try:
            if not db.query(User).filter(User.email == "srivastavishan82@gmail.com").first():
                ishan = User(email="srivastavishan82@gmail.com", hashed_password=hash_password("admin123"), full_name="Ishan Srivastav", role="admin")
                db.add(ishan)
                db.commit()
                print("Seeded local development administrator")
            if not db.query(User).filter(User.email == "admin@lrds.gov.in").first():
                admin = User(email="admin@lrds.gov.in", hashed_password=hash_password("admin123"), full_name="Revenue Admin", role="admin")
                db.add(admin)
                db.commit()
                print("Seeded local development revenue administrator")
            if not db.query(User).filter(User.email == "verifier@lrds.gov.in").first():
                verifier = User(email="verifier@lrds.gov.in", hashed_password=hash_password("verify123"), full_name="Verifier One", role="verifier")
                db.add(verifier)
                db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"DB init failed: {e}")
    yield

app = FastAPI(
    title="Land Record Digitization API",
    description="SIH 2026 - AI-powered land record digitization and validation system. SQLite mode (PostgreSQL deferred).",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins: "*" cannot be used with allow_credentials=True (browsers reject it)
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"service": "Bhoomi AI - Land Record Digitization", "health": "/health", "docs": "/docs", "frontend_proxy": "http://localhost:5173"}

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "land-record-digitization", "db": RESOLVED_DB_URL, "uploads": os.getenv("UPLOAD_DIR", "./uploads")}

@app.get("/api/v1/protected-doc")
def protected_doc_example(api_key=Depends(get_api_key)):
    return {"message": "OK", "api_key_prefix": api_key.prefix}

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
authenticated = [Depends(get_current_active_user)]
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"], dependencies=authenticated)
app.include_router(ocr.router, prefix="/api/v1/ocr", tags=["ocr"], dependencies=authenticated)
app.include_router(validation.router, prefix="/api/v1/validation", tags=["validation"], dependencies=authenticated)
app.include_router(verification.router, prefix="/api/v1/verification", tags=["verification"], dependencies=authenticated)
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"], dependencies=authenticated)
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["integrations"], dependencies=authenticated)
app.include_router(api_keys.router, prefix="/api/v1/api-keys", tags=["api-keys"])

