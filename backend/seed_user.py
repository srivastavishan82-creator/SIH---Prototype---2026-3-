"""Seed/Update user in database."""
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.database import SessionLocal, init_db
from app.models import User
from app.auth import hash_password

def seed_ishan_account():
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "srivastavishan82@gmail.com").first()
        if not user:
            user = User(
                email="srivastavishan82@gmail.com",
                hashed_password=hash_password("admin123"),
                full_name="Ishan Srivastav",
                role="admin",
                is_active=True
            )
            db.add(user)
            db.commit()
            print("[SUCCESS] Created Administrator account: srivastavishan82@gmail.com / admin123")
        else:
            user.role = "admin"
            user.is_active = True
            user.hashed_password = hash_password("admin123")
            user.full_name = "Ishan Srivastav"
            db.commit()
            print("[SUCCESS] Updated existing account: srivastavishan82@gmail.com / admin123 (role: admin)")
    finally:
        db.close()

if __name__ == "__main__":
    seed_ishan_account()
