from decimal import (
    Decimal,
    ROUND_HALF_UP,
)

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    require_roles,
)

from app.database import get_db

from app.models.compensation import CompensationEstimate
from app.models.parcel import Parcel
from app.models.project import Project
from app.models.user import User

from app.schemas.compensation import (
    CompensationEstimateCreate,
    CompensationEstimateResponse,
)


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Compensation Planning"],
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
    "/{project_id}/compensation-estimates",
    response_model=list[CompensationEstimateResponse],
)
def list_compensation_estimates(
    project_id: int,
    db: Session = Depends(get_db),
):
    require_project(db, project_id)

    return db.execute(
        select(CompensationEstimate)
        .where(
            CompensationEstimate.project_id == project_id
        )
        .order_by(CompensationEstimate.id.desc())
    ).scalars().all()


@router.post(
    "/{project_id}/compensation-estimates",
    response_model=CompensationEstimateResponse,
    status_code=201,
)
def create_compensation_estimate(
    project_id: int,
    payload: CompensationEstimateCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(
        require_roles("PROJECT_OFFICER")
    ),
):
    require_project(db, project_id)

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

    # This is a user-supplied planning formula,
    # not a statutory compensation calculation.
    #
    # Estimated total =
    #     proposed area * indicative rate
    #     + additional planning amount

    estimated_total = (
        payload.proposed_area_ha
        * payload.indicative_rate_per_ha
        + payload.additional_planning_amount
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    if estimated_total > Decimal(
        "9999999999999999.99"
    ):
        raise HTTPException(
            status_code=422,
            detail="Estimated total exceeds the supported range.",
        )

    estimate = CompensationEstimate(
        project_id=project_id,
        parcel_id=payload.parcel_id,
        proposed_area_ha=payload.proposed_area_ha,
        indicative_rate_per_ha=payload.indicative_rate_per_ha,
        additional_planning_amount=(
            payload.additional_planning_amount
        ),
        estimated_total=estimated_total,
        remarks=(
            payload.remarks.strip()
            if payload.remarks
            else None
        ),
        created_by_username=actor.username,
    )

    db.add(estimate)
    db.commit()
    db.refresh(estimate)

    return estimate