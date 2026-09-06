from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os

try:
    from dotenv import load_dotenv
    # Load backend/.env regardless of cwd (fixes env ignored when started elsewhere)
    _env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(_env_path)
except Exception:
    pass

# SQLite default so backend runs without PostgreSQL; switch to Supabase/Postgres via DATABASE_URL env
# Supabase example (Transaction pooler, IPv4-safe):
#   DATABASE_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./landrecords.db")

# Normalize legacy scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite:///")
IS_POSTGRES = DATABASE_URL.startswith("postgresql://")

# Supabase always needs SSL; auto-append if user pasted a URL without it
if IS_POSTGRES and "supabase.com" in DATABASE_URL and "sslmode=" not in DATABASE_URL:
    sep = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"

# Resolve relative sqlite paths against backend/ dir so DB location doesn't depend on cwd
if IS_SQLITE:
    _raw_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not os.path.isabs(_raw_path):
        _backend_dir = os.path.dirname(os.path.dirname(__file__))
        # Strip leading ./ if present
        if _raw_path.startswith("./"):
            _raw_path = _raw_path[2:]
        elif _raw_path.startswith(".\\"):
            _raw_path = _raw_path[2:]
        _abs = os.path.join(_backend_dir, _raw_path)
        DATABASE_URL = f"sqlite:///{_abs}"

if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    # Postgres / Supabase (pooler-friendly): recycle stale pooler connections
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=300,
        echo=False,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # import models to register tables on Base
    import app.models  # noqa
    Base.metadata.create_all(bind=engine)
    # create_all does not add columns to databases created by earlier prototypes.
    columns = {column["name"] for column in inspect(engine).get_columns("documents")}
    if "doc_type" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE documents ADD COLUMN doc_type VARCHAR(50) DEFAULT 'register'"))
    # PostGIS cadastral layer — geometry lives in dedicated table to keep SQLite compat
    if IS_POSTGRES:
        with engine.begin() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            except Exception:
                pass
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS cadastral_parcels (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
                    survey_no VARCHAR(100) NOT NULL,
                    village VARCHAR(100),
                    district VARCHAR(100),
                    geom GEOMETRY(Polygon, 4326),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            # migrate existing table created without geom (from earlier Base.create_all)
            try:
                cols = {r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='cadastral_parcels'")).fetchall()}
                if "geom" not in cols:
                    conn.execute(text("ALTER TABLE cadastral_parcels ADD COLUMN geom GEOMETRY(Polygon, 4326)"))
            except Exception:
                pass
            try:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_parcels_geom ON cadastral_parcels USING GIST (geom)"))
            except Exception:
                pass
            try:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_parcels_survey ON cadastral_parcels(survey_no)"))
            except Exception:
                pass
