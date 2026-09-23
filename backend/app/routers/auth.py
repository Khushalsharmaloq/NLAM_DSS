from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user

from app.core.security import (
    create_access_token,
    verify_password,
)

from app.database import get_db

from app.models.user import User

from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
)


router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)


def serialize_user(user: User) -> UserResponse:

    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):

    username = payload.username.strip().lower()

    user = db.execute(
        select(User).where(
            User.username == username
        )
    ).scalar_one_or_none()

    if (
        user is None
        or not user.is_active
        or not verify_password(
            payload.password,
            user.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=8 * 60 * 60,
        user=serialize_user(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):

    return serialize_user(current_user)