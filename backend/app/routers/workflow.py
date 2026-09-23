from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db

from app.models.project import Project

from app.models.workflow import ProjectWorkflowEvent

from app.schemas.workflow import (
    WorkflowEventResponse,
    WorkflowTransitionRequest,
    WorkflowTransitionResponse,
)


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Project Workflow"],
    dependencies=[Depends(get_current_user)],
)


# Allowed state transitions for the local prototype.
#
# These actions simulate administrative processing.
# They must not be treated as official legal approvals.


ACTION_ROLES = {
    "SUBMIT": {"PROJECT_OFFICER"},
    "START_REVIEW": {"DISTRICT_AUTHORITY"},
    "RETURN": {"DISTRICT_AUTHORITY"},
    "APPROVE": {"STATE_AUTHORITY"},
    "REJECT": {"STATE_AUTHORITY"},
}


TRANSITIONS = {
    "DRAFT": {
        "SUBMIT": "SUBMITTED",
    },

    "SUBMITTED": {
        "START_REVIEW": "UNDER_REVIEW",
    },

    "UNDER_REVIEW": {
        "RETURN": "RETURNED",
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
    },

    "RETURNED": {
        "SUBMIT": "SUBMITTED",
    },

    "APPROVED": {},

    "REJECTED": {},
}


def get_existing_project(
    db: Session,
    project_id: int,
):

    project = db.get(Project, project_id)

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    return project


@router.get(
    "/{project_id}/workflow",
)
def get_project_workflow(
    project_id: int,
    db: Session = Depends(get_db),
):

    project = get_existing_project(
        db,
        project_id,
    )

    allowed_actions = list(
        TRANSITIONS.get(
            project.status,
            {},
        ).keys()
    )

    return {
        "project_id": project.id,
        "current_status": project.status,
        "allowed_actions": allowed_actions,
        "simulation": True,
        "message": (
            "Prototype workflow. Actions do not "
            "constitute official administrative approval."
        ),
    }


@router.post(
    "/{project_id}/workflow/transition",
    response_model=WorkflowTransitionResponse,
)
def transition_project(
    project_id: int,
    payload: WorkflowTransitionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    permitted_roles = ACTION_ROLES[payload.action]

    if current_user.role not in permitted_roles:
        raise HTTPException(
            status_code=403,
            detail=(
                "Your role does not permit "
                "this workflow action."
            ),
        )

    # Lock the project record while evaluating and
    # applying the transition to prevent concurrent
    # requests from bypassing the state rules.

    project = db.execute(
        select(Project)
        .where(Project.id == project_id)
        .with_for_update()
    ).scalar_one_or_none()

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    current_status = project.status

    allowed = TRANSITIONS.get(
        current_status,
        {},
    )

    if payload.action not in allowed:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Action {payload.action} is not "
                f"allowed from status {current_status}."
            ),
        )

    comment = (
        payload.comment.strip()
        if payload.comment
        else None
    )

    if (
        payload.action in ("RETURN", "REJECT")
        and not comment
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "A comment is required when "
                "returning or rejecting a proposal."
            ),
        )

    next_status = allowed[payload.action]

    project.status = next_status

    event = ProjectWorkflowEvent(
        project_id=project.id,
        action=payload.action,
        previous_status=current_status,
        new_status=next_status,
        comment=comment,
        actor_reference=current_user.username,
    )

    db.add(event)

    db.commit()

    db.refresh(event)

    return {
        "project_id": project.id,
        "previous_status": current_status,
        "current_status": next_status,
        "action": payload.action,
        "event_id": event.id,
        "message": (
            "Prototype workflow transition "
            "recorded successfully."
        ),
    }


@router.get(
    "/{project_id}/workflow/history",
    response_model=list[WorkflowEventResponse],
)
def get_workflow_history(
    project_id: int,
    db: Session = Depends(get_db),
):

    get_existing_project(
        db,
        project_id,
    )

    events = db.execute(
        select(ProjectWorkflowEvent)
        .where(
            ProjectWorkflowEvent.project_id
            == project_id
        )
        .order_by(
            ProjectWorkflowEvent.id.desc()
        )
    ).scalars().all()

    return events