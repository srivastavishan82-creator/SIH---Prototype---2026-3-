from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import authenticate_user, create_access_token, hash_password, get_current_user
from app.models import User, AuditLog
from app.schemas import UserCreate, UserUpdate, User as UserSchema


def _audit(db, user: User, action: str):
    try:
        db.add(AuditLog(user_id=user.id, action=action, entity_type="user", entity_id=user.id, new_value=user.email))
        db.commit()
    except Exception:
        db.rollback()

router = APIRouter()

@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_user = User(
        email=email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        role="citizen",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    _audit(db, db_user, "register")
    return db_user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = (form_data.username or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email is required")
    # Field Inspector is strictly authenticated — only verifier@lrds.gov.in / verify123
    if email == "verifier@lrds.gov.in":
        user = authenticate_user(db, email, form_data.password or "")
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password for Field Inspector")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
    else:
        # Demo: every other email logs in as citizen with ANY password (auto-provisioned)
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raw_pw = (form_data.password or "demo")[:72]
            user = User(email=email, hashed_password=hash_password(raw_pw), full_name=email.split("@")[0] or "Demo User", role="citizen")
            db.add(user)
            db.commit()
            db.refresh(user)
        elif not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
    _audit(db, user, "login")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "email": user.email}

@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/me", response_model=UserSchema)
def update_users_me(payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.full_name = payload.full_name.strip()
    db.add(current_user)
    db.add(AuditLog(user_id=current_user.id, action="profile_update", entity_type="user", entity_id=current_user.id, new_value=current_user.full_name))
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/users", response_model=List[UserSchema])
def list_users(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "govt_official"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    users = db.query(User).offset(skip).limit(limit).all()
    return users
