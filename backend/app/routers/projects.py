from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.database import get_db
from app.core.project_access_dependency import get_accessible_project, project_scope
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Projects"],
    dependencies=[Depends(get_current_user)],
)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("PROJECT_OFFICER")),
):

    project = Project(
        name=payload.name,
        state=actor.state or payload.state,
        district=actor.district or payload.district,
        proposed_area_ha=payload.proposed_area_ha,
        status="DRAFT",
        owner_username=actor.username,
        agency=payload.agency,
        sector=payload.sector,
        description=payload.description,
        target_date=payload.target_date,
    )

    if not actor.state or payload.state.casefold() != actor.state.casefold():
        raise HTTPException(403, "Project state must match your assigned jurisdiction.")
    if actor.district and payload.district.casefold() != actor.district.casefold():
        raise HTTPException(403, "Project district must match your assigned jurisdiction.")

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get(
    "",
    response_model=list[ProjectResponse],
)
def list_projects(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):

    statement = select(Project).where(project_scope(user)).order_by(
        Project.id.desc()
    )

    return db.scalars(statement).all()


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
)
def get_project(
    project: Project = Depends(get_accessible_project),
):
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, payload: ProjectCreate,
                   actor=Depends(require_roles("PROJECT_OFFICER")),
                   project: Project = Depends(get_accessible_project),
                   db: Session = Depends(get_db)):
    project = db.execute(select(Project).where(Project.id == project_id).with_for_update()).scalar_one()
    if project.status not in ("DRAFT", "RETURNED"):
        raise HTTPException(409, "Only draft or returned proposals may be edited.")
    if payload.state.casefold() != (actor.state or "").casefold() or (
        actor.district and payload.district.casefold() != actor.district.casefold()
    ):
        raise HTTPException(403, "Project location must match your assigned jurisdiction.")
    for field in ("name", "proposed_area_ha", "agency", "sector", "description", "target_date"):
        setattr(project, field, getattr(payload, field))
    project.state = actor.state
    project.district = actor.district or payload.district
    db.commit()
    db.refresh(project)
    return project
