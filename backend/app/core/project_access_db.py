"""Database-backed project access checks.

Do not attach these checks to live API routes until migration 002
and user jurisdiction assignments have been deployed.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.project_access import can_access_project
from app.models.project_assignment import ProjectUserAssignment


def user_has_project_assignment(
    db: Session,
    user_id: int,
    project_id: int,
) -> bool:
    """Check an explicit assignment stored in the database."""

    assignment = db.scalar(
        select(ProjectUserAssignment.user_id).where(
            ProjectUserAssignment.user_id == user_id,
            ProjectUserAssignment.project_id == project_id,
        )
    )

    return assignment is not None


def can_access_project_in_db(
    db: Session,
    user,
    project,
) -> bool:
    """Evaluate project access using persisted assignments."""

    role = getattr(user, "role", None)

    if role == "PROJECT_OFFICER":
        user_id = getattr(user, "id", None)
        project_id = getattr(project, "id", None)

        if user_id is None or project_id is None:
            return False

        assigned = user_has_project_assignment(
            db,
            user_id,
            project_id,
        )

        return can_access_project(
            user,
            project,
            has_project_assignment=assigned,
        )

    return can_access_project(user, project)
