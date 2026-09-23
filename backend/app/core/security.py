import os

from datetime import datetime, timedelta, timezone

import jwt

from pwdlib import PasswordHash


JWT_SECRET = os.environ["JWT_SECRET"]

JWT_ALGORITHM = "HS256"

JWT_ISSUER = "nlam-dss-local"

JWT_AUDIENCE = "nlam-dss-web"

ACCESS_TOKEN_HOURS = 8


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:

    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:

    return password_hash.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(user_id: int) -> str:

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(
            hours=ACCESS_TOKEN_HOURS
        ),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> int:

    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
        options={
            "require": [
                "sub",
                "iat",
                "exp",
                "iss",
                "aud",
            ],
        },
    )

    user_id = int(payload["sub"])

    if user_id <= 0:
        raise ValueError("Invalid user identifier.")

    return user_id