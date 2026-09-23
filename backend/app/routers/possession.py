from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.project_access_dependency import get_accessible_project
from app.database import get_db

from app.models.parcel import Parcel
from app.models.possession import ParcelProgressEvent
from app.models.project import Project
from app.models.user import User

from app.schemas.possession import ParcelProgressRequest


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Parcel Acquisition Progress"],
    dependencies=[Depends(get_current_user)],
)


NEXT_STAGES = {
    "REGISTERED": {
        "RECORD_SURVEY": "SURVEY_RECORDED",
    },
    "SURVEY_RECORDED": {
        "RECORD_DOCUMENTATION": "DOCUMENTATION_RECORDED",
    },
    "DOCUMENTATION_RECORDED": {
        "RECORD_POSSESSION": "POSSESSION_RECORDED",
    },
    "POSSESSION_RECORDED": {},
}


ACTION_ROLES = {
    "RECORD_SURVEY": "PROJECT_OFFICER",
    "RECORD_DOCUMENTATION": "PROJECT_OFFICER",
    "RECORD_POSSESSION": "DISTRICT_AUTHORITY",
}


def require_project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    return project


@router.get("/{project_id}/possession-progress", dependencies=[Depends(get_accessible_project)])
def list_parcel_progress(
    project_id: int,
    db: Session = Depends(get_db),
):
    require_project(db, project_id)

    parcels = db.execute(
        select(Parcel)
        .where(Parcel.project_id == project_id)
        .order_by(Parcel.id.asc())
    ).scalars().all()

    events = db.execute(
        select(ParcelProgressEvent)
        .where(
            ParcelProgressEvent.project_id == project_id
        )
        .order_by(ParcelProgressEvent.id.asc())
    ).scalars().all()

    events_by_parcel: dict[int, list[ParcelProgressEvent]] = {}

    for event in events:
        events_by_parcel.setdefault(
            event.parcel_id,
            [],
        ).append(event)

    result = []

    for parcel in parcels:
        history = events_by_parcel.get(parcel.id, [])

        current_stage = (
            history[-1].new_stage
            if history
            else "REGISTERED"
        )

        result.append({
            "parcel_id": parcel.id,
            "survey_number": parcel.survey_number,
            "village": parcel.village,
            "current_stage": current_stage,
            "history": [
                {
                    "id": event.id,
                    "action": event.action,
                    "previous_stage": event.previous_stage,
                    "new_stage": event.new_stage,
                    "remarks": event.remarks,
                    "recorded_by_username": (
                        event.recorded_by_username
                    ),
                    "recorded_at": event.recorded_at,
                }
                for event in history
            ],
        })

    return result


@router.post(
    "/{project_id}/parcels/{parcel_id}/progress",
    dependencies=[Depends(get_accessible_project)],
    status_code=201,
)
def record_parcel_progress(
    project_id: int,
    parcel_id: int,
    payload: ParcelProgressRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    required_role = ACTION_ROLES[payload.action]

    if actor.role != required_role:
        raise HTTPException(
            status_code=403,
            detail="Your role does not permit this progress action.",
        )

    # Lock the parcel while checking its latest event.
    # This serializes concurrent progress updates for one parcel.
    parcel = db.execute(
        select(Parcel)
        .where(
            Parcel.id == parcel_id,
            Parcel.project_id == project_id,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if parcel is None:
        raise HTTPException(
            status_code=404,
            detail="Parcel not found under this project.",
        )

    project = require_project(db, project_id)

    previous_event = db.execute(
        select(ParcelProgressEvent)
        .where(
            ParcelProgressEvent.project_id == project_id,
            ParcelProgressEvent.parcel_id == parcel_id,
        )
        .order_by(ParcelProgressEvent.id.desc())
        .limit(1)
    ).scalar_one_or_none()

    current_stage = (
        previous_event.new_stage
        if previous_event
        else "REGISTERED"
    )

    next_stage = NEXT_STAGES[current_stage].get(
        payload.action
    )

    if next_stage is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Action {payload.action} is not permitted "
                f"from stage {current_stage}."
            ),
        )

    remarks = (
        payload.remarks.strip()
        if payload.remarks
        else None
    )

    if payload.action == "RECORD_POSSESSION":
        if project.status != "APPROVED":
            raise HTTPException(
                status_code=409,
                detail=(
                    "The project must be APPROVED before "
                    "recording the demonstration possession milestone."
                ),
            )

        if not remarks:
            raise HTTPException(
                status_code=422,
                detail="Remarks are required for the possession milestone.",
            )

    event = ParcelProgressEvent(
        project_id=project_id,
        parcel_id=parcel_id,
        action=payload.action,
        previous_stage=current_stage,
        new_stage=next_stage,
        remarks=remarks,
        recorded_by_username=actor.username,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return {
        "event_id": event.id,
        "project_id": project_id,
        "parcel_id": parcel_id,
        "previous_stage": current_stage,
        "current_stage": next_stage,
        "recorded_by_username": actor.username,
        "recorded_at": event.recorded_at,
        "message": (
            "Synthetic parcel progress event recorded. "
            "This is not a legal possession certification."
        ),
    }
