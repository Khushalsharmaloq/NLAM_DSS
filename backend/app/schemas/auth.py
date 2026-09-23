from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):

    username: str = Field(
        min_length=3,
        max_length=80,
    )

    password: str = Field(
        min_length=1,
    )


class UserResponse(BaseModel):

    id: int

    username: str

    full_name: str

    role: str

    is_active: bool

    created_at: datetime


class TokenResponse(BaseModel):

    access_token: str

    token_type: str = "bearer"

    expires_in: int

    user: UserResponse