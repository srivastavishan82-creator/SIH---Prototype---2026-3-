"""Copy all rows from local SQLite landrecords.db into Supabase Postgres.

Usage (PowerShell, from backend/ folder):
  pip install -r requirements.txt   # installs psycopg2-binary
  $env:DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"
  python migrate_sqlite_to_supabase.py
  # optional: python migrate_sqlite_to_supabase.py --sqlite ./landrecords.db --postgres "postgresql://..."

What it does:
  1. Creates tables on Supabase via Base.metadata.create_all()
  2. Copies users, api_keys, documents, extracted_fields, audit_logs preserving IDs
  3. Resets Postgres sequences so new inserts don't clash
  NOTE: uploaded files in backend/uploads/ are NOT in the DB - redeploy or re-upload them separately.
"""
import argparse
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except Exception:
    pass

TABLES_IN_ORDER = ["users", "documents", "extracted_fields", "api_keys", "audit_logs"]


def _normalize(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if "supabase.com" in url and "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", default=os.path.join(os.path.dirname(__file__), "landrecords.db"))
    ap.add_argument("--postgres", default=os.getenv("DATABASE_URL", ""))
    args = ap.parse_args()

    if not args.postgres or args.postgres.startswith("sqlite"):
        print("ERROR: set DATABASE_URL to your Supabase Postgres URL first.")
        print('  $env:DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"')
        return 2
    pg_url = _normalize(args.postgres)
    if not os.path.isfile(args.sqlite):
        print(f"ERROR: sqlite file not found: {args.sqlite}")
        return 2

    try:
        import sqlalchemy as sa
    except ImportError:
        print("ERROR: sqlalchemy not installed. Run: pip install -r requirements.txt")
        return 2
    try:
        import psycopg2  # noqa: F401  (driver check for clearer error)
    except ImportError:
        print("ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary")
        return 2

    # Reflect SQLite schema+rows without importing app models (avoids engine side-effects)
    src = sa.create_engine(f"sqlite:///{args.sqlite}")
    src_meta = sa.MetaData()
    src_meta.reflect(bind=src)

    missing = [t for t in TABLES_IN_ORDER if t not in src_meta.tables]
    if missing:
        print(f"WARNING: sqlite missing tables {missing} - they will be skipped")

    # Create destination tables using app models, then copy row-by-row
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)) if False else os.path.dirname(__file__))
    # backend/ is cwd-safe: migrate script lives in backend/, app/ is sibling
    if os.path.isdir(os.path.join(os.getcwd(), "app")):
        sys.path.insert(0, os.getcwd())
    from app.database import Base  # noqa: E402
    import app.models  # noqa: F401,E402

    dst = sa.create_engine(pg_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=dst)
    print("Supabase tables ensured.")

    total = 0
    with src.connect() as sconn, dst.begin() as dconn:
        for tname in TABLES_IN_ORDER:
            if tname not in src_meta.tables:
                continue
            stable = src_meta.tables[tname]
            rows = sconn.execute(sa.select(stable)).mappings().all()
            if not rows:
                print(f"  {tname}: 0 rows (skipped)")
                continue
            dtable = Base.metadata.tables[tname]
            # delete existing destination rows to make migration idempotent, then re-insert
            dconn.execute(dtable.delete())
            dconn.execute(dtable.insert(), [dict(r) for r in rows])
            print(f"  {tname}: copied {len(rows)} rows")
            total += len(rows)
        # fix serial sequences (users_id_seq etc.)
        for tname in TABLES_IN_ORDER:
            if tname not in Base.metadata.tables:
                continue
            try:
                dconn.execute(
                    sa.text(
                        "SELECT setval(pg_get_serial_sequence(:t, 'id'), "
                        "COALESCE((SELECT MAX(id) FROM " + tname + "), 0) + 1, false)"
                    ).bindparams(t=sa.bindparam("t", value=tname, literal_execute=True))
                )
            except Exception as e:  # noqa: BLE001 - sequence may not exist for some tables
                print(f"  {tname}: sequence reset skipped ({e})")

    print(f"DONE: migrated {total} rows into Supabase.")
    print("Next: set DATABASE_URL in backend/.env to the same Supabase URL and restart: uvicorn app.main:app --port 8000")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
