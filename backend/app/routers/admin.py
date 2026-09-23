"""Accounts and jurisdiction assignments controlled by the system administrator."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.routers.auth import serialize_user

router = APIRouter(prefix="/api/v1/users", tags=["Administration"])
Role = Literal["SYSTEM_ADMIN", "CENTRAL_MINISTRY", "STATE_AUTHORITY",
               "DISTRICT_AUTHORITY", "PROJECT_OFFICER"]


class UserInput(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9._-]+$")
    full_name: str = Field(min_length=2, max_length=150)
    role: Role
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain a letter and a number.")
        return value


class UserUpdate(BaseModel):
    is_active: bool | None = None
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    full_name: str | None = Field(default=None, min_length=2, max_length=150)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=12, max_length=128)


@router.get("")
def list_users(db: Session = Depends(get_db), actor: User = Depends(require_roles("SYSTEM_ADMIN"))):
    return [serialize_user(u) for u in db.scalars(select(User).order_by(User.id)).all()]


@router.post("", status_code=201)
def create_user(payload: UserInput, db: Session = Depends(get_db),
                actor: User = Depends(require_roles("SYSTEM_ADMIN"))):
    if payload.role in ("PROJECT_OFFICER", "STATE_AUTHORITY", "DISTRICT_AUTHORITY") and not payload.state:
        raise HTTPException(422, "Assigned state is required for this role.")
    if payload.role == "DISTRICT_AUTHORITY" and not payload.district:
        raise HTTPException(422, "Assigned district is required for this role.")
    user = User(username=payload.username, full_name=payload.full_name.strip(), role=payload.role,
                state=payload.state if payload.role not in ("SYSTEM_ADMIN", "CENTRAL_MINISTRY") else None,
                district=payload.district if payload.role in ("DISTRICT_AUTHORITY", "PROJECT_OFFICER") else None,
                hashed_password=hash_password(payload.password), is_active=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Username already exists.")
    db.refresh(user)
    return serialize_user(user)


@router.patch("/{user_id}")
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db),
                actor: User = Depends(require_roles("SYSTEM_ADMIN"))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    data = payload.model_dump(exclude_unset=True)
    if user.id == actor.id and data.get("is_active") is False:
        raise HTTPException(409, "You cannot deactivate your own account.")
    for key, value in data.items():
        setattr(user, key, value)
    if user.role in ("PROJECT_OFFICER", "STATE_AUTHORITY", "DISTRICT_AUTHORITY") and not user.state:
        raise HTTPException(422, "Assigned state is required for this role.")
    if user.role == "DISTRICT_AUTHORITY" and not user.district:
        raise HTTPException(422, "Assigned district is required for this role.")
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.post("/change-password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db),
                    actor: User = Depends(get_current_user)):
    if not verify_password(payload.old_password, actor.hashed_password):
        raise HTTPException(403, "Current password is incorrect.")
    if not any(c.isalpha() for c in payload.new_password) or not any(c.isdigit() for c in payload.new_password):
        raise HTTPException(422, "Password must contain a letter and a number.")
    actor.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated."}
