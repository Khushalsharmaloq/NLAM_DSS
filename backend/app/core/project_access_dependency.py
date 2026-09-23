"""Object-level and geographic authorization shared across all project routes."""
from fastapi import Depends, HTTPException
from sqlalchemy import and_, false, or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.project import Project
from app.models.user import User


def project_scope(user: User):
    if user.role in ("SYSTEM_ADMIN", "CENTRAL_MINISTRY"):
        return Project.id > 0
    if user.role == "PROJECT_OFFICER":
        return and_(Project.owner_username == user.username,
                    Project.state == user.state) if user.state else false()
    if user.role == "STATE_AUTHORITY" and user.state:
        return Project.state == user.state
    if user.role == "DISTRICT_AUTHORITY" and user.state and user.district:
        return and_(Project.state == user.state, Project.district == user.district)
    return false()


def can_access(user: User, project: Project) -> bool:
    if user.role in ("SYSTEM_ADMIN", "CENTRAL_MINISTRY"):
        return True
    if user.role == "PROJECT_OFFICER":
        return bool(user.state and project.state == user.state
                    and project.owner_username == user.username)
    if user.role == "STATE_AUTHORITY":
        return bool(user.state and project.state == user.state)
    if user.role == "DISTRICT_AUTHORITY":
        return bool(user.state and user.district and project.state == user.state
                    and project.district == user.district)
    return False


def get_accessible_project(project_id: int, db: Session = Depends(get_db),
                           user: User = Depends(get_current_user)) -> Project:
    project = db.get(Project, project_id)
    # Do not disclose whether a project exists outside the user's scope.
    if project is None or not can_access(user, project):
        raise HTTPException(404, "Project not found.")
    return project
