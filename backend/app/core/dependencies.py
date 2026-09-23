from fastapi import Depends, HTTPException, status

from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from jwt.exceptions import InvalidTokenError

from sqlalchemy.orm import Session

from app.core.security import decode_access_token

from app.database import get_db

from app.models.user import User


bearer_scheme = HTTPBearer(
    auto_error=False,
)


def authentication_error():

    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required or token invalid.",
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:

    if credentials is None:
        raise authentication_error()

    try:
        user_id = decode_access_token(
            credentials.credentials
        )

    except (InvalidTokenError, ValueError, TypeError):
        raise authentication_error()

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise authentication_error()

    return user

def require_roles(*allowed_roles: str):
    """
    Require authentication and one of the specified roles.

    The user's role is retrieved from the database.
    It is never accepted from request data.
    """

    def check_role(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role not in allowed_roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to perform this operation."
                ),
            )

        return current_user

    return check_role