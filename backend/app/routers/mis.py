from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db

from app.models.project import Project
from app.models.parcel import Parcel
from app.models.compensation import CompensationEstimate
from app.models.rr import RRHousehold
from app.models.possession import ParcelProgressEvent


router = APIRouter(
    prefix="/api/v1/mis",
    tags=["Management Information System"],
    dependencies=[Depends(get_current_user)],
)


PROJECT_STATUSES = (
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "RETURNED",
    "REJECTED",
)

PARCEL_STAGES = (
    "REGISTERED",
    "SURVEY_RECORDED",
    "DOCUMENTATION_RECORDED",
    "POSSESSION_RECORDED",
)


@router.get("/overview")
def get_mis_overview(
    db: Session = Depends(get_db),
):
    # The local demonstration database is small. Read the
    # registered records and derive a consistent overview
    # without altering any operational data.

    projects = db.execute(
        select(Project)
    ).scalars().all()

    parcels = db.execute(
        select(Parcel)
    ).scalars().all()

    estimates = db.execute(
        select(CompensationEstimate)
        .order_by(CompensationEstimate.id.asc())
    ).scalars().all()

    households = db.execute(
        select(RRHousehold)
    ).scalars().all()

    progress_events = db.execute(
        select(ParcelProgressEvent)
        .order_by(ParcelProgressEvent.id.asc())
    ).scalars().all()

    # Project statistics.

    project_status_counts = {
        status: 0
        for status in PROJECT_STATUSES
    }

    for project in projects:
        project_status_counts[project.status] = (
            project_status_counts.get(project.status, 0) + 1
        )

    proposed_area = sum(
        (
            project.proposed_area_ha
            for project in projects
        ),
        Decimal("0.0000"),
    )

    # Parcel statistics. An existing parcel with no
    # progress events is at REGISTERED.

    latest_stage_by_parcel: dict[int, str] = {}

    for event in progress_events:
        latest_stage_by_parcel[event.parcel_id] = (
            event.new_stage
        )

    parcel_stage_counts = {
        stage: 0
        for stage in PARCEL_STAGES
    }

    for parcel in parcels:
        current_stage = latest_stage_by_parcel.get(
            parcel.id,
            "REGISTERED",
        )

        parcel_stage_counts[current_stage] = (
            parcel_stage_counts.get(current_stage, 0) + 1
        )

    # Compensation statistics.
    #
    # Count every saved estimate as a historical record,
    # but use only the latest estimate ID for each parcel
    # when calculating the current planning total.
    #
    # This is NOT an approved award or payment total.

    latest_estimate_by_parcel = {}

    for estimate in estimates:
        latest_estimate_by_parcel[estimate.parcel_id] = (
            estimate
        )

    current_compensation_planning_total = sum(
        (
            estimate.estimated_total
            for estimate in latest_estimate_by_parcel.values()
        ),
        Decimal("0.00"),
    )

    # R&R statistics. These are synthetic planning records,
    # not verified beneficiary or entitlement figures.

    affected_persons = sum(
        household.affected_persons
        for household in households
    )

    relocation_anticipated = sum(
        1
        for household in households
        if household.relocation_required
    )

    indicative_assistance_total = sum(
        (
            household.indicative_assistance_inr
            for household in households
        ),
        Decimal("0.00"),
    )

    return {
        "project_count": len(projects),
        "proposed_area_ha": f"{proposed_area:.4f}",
        "states_count": len({
            project.state
            for project in projects
        }),
        "project_status_counts": project_status_counts,

        "parcel_count": len(parcels),
        "parcel_stage_counts": parcel_stage_counts,

        "compensation_estimate_records": len(estimates),
        "compensation_parcels_with_estimates": len(
            latest_estimate_by_parcel
        ),
        "compensation_latest_per_parcel_total_inr": (
            f"{current_compensation_planning_total:.2f}"
        ),

        "rr_household_count": len(households),
        "rr_affected_persons": affected_persons,
        "rr_relocation_anticipated_households": (
            relocation_anticipated
        ),
        "rr_indicative_assistance_total_inr": (
            f"{indicative_assistance_total:.2f}"
        ),
    }