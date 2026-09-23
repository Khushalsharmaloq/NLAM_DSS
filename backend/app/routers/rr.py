from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    require_roles,
)

from app.core.project_access_dependency import get_accessible_project
from app.database import get_db
from app.models.parcel import Parcel
from app.models.project import Project
from app.models.rr import RRHousehold
from app.models.user import User

from app.schemas.rr import (
    RRHouseholdCreate,
    RRHouseholdResponse,
)


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["R&R Planning"],
    dependencies=[Depends(get_current_user)],
)


def require_project(
    db: Session,
    project_id: int,
) -> None:
    if db.get(Project, project_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )


@router.get(
    "/{project_id}/rr-households",
    dependencies=[Depends(get_accessible_project)],
    response_model=list[RRHouseholdResponse],
)
def list_rr_households(
    project_id: int,
    db: Session = Depends(get_db),
):
    require_project(db, project_id)

    return db.execute(
        select(RRHousehold)
        .where(RRHousehold.project_id == project_id)
        .order_by(RRHousehold.id.desc())
    ).scalars().all()


@router.post(
    "/{project_id}/rr-households",
    dependencies=[Depends(get_accessible_project)],
    response_model=RRHouseholdResponse,
    status_code=201,
)
def create_rr_household(
    project_id: int,
    payload: RRHouseholdCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(
        require_roles("PROJECT_OFFICER")
    ),
):
    require_project(db, project_id)

    reference = payload.household_reference.strip().upper()
    village = payload.village.strip()

    if len(village) < 2:
        raise HTTPException(
            status_code=422,
            detail="A village name is required.",
        )

    if payload.parcel_id is not None:
        parcel = db.get(Parcel, payload.parcel_id)

        if (
            parcel is None
            or parcel.project_id != project_id
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "The selected parcel does not "
                    "belong to this project."
                ),
            )

    existing = db.execute(
        select(RRHousehold.id).where(
            RRHousehold.project_id == project_id,
            RRHousehold.household_reference == reference,
        )
    ).scalar_one_or_none()

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This household reference is already "
                "registered for the project."
            ),
        )

    record = RRHousehold(
        project_id=project_id,
        parcel_id=payload.parcel_id,
        household_reference=reference,
        village=village,
        affected_persons=payload.affected_persons,
        impact_type=payload.impact_type,
        relocation_required=payload.relocation_required,
        assistance_type=payload.assistance_type,
        indicative_assistance_inr=(
            payload.indicative_assistance_inr
        ),
        remarks=(
            payload.remarks.strip()
            if payload.remarks
            else None
        ),
        created_by_username=actor.username,
    )

    db.add(record)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "This household reference is already "
                "registered for the project."
            ),
        )

    db.refresh(record)

    return record