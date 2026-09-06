import psycopg2

import os

DATABASE_URL = os.environ.get("DATABASE_URL")

def fix_sequence():
    if not DATABASE_URL:
        raise RuntimeError("Set DATABASE_URL before running this utility")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    tables = ["users", "documents", "audit_logs", "fields"]
    
    for table in tables:
        try:
            cur.execute(f"SELECT setval('{table}_id_seq', COALESCE((SELECT MAX(id)+1 FROM {table}), 1), false);")
            print(f"Fixed sequence for {table}")
        except Exception as e:
            print(f"Failed to fix sequence for {table}: {e}")
            conn.rollback()
            continue
        conn.commit()

    cur.close()
    conn.close()

if __name__ == "__main__":
    fix_sequence()
