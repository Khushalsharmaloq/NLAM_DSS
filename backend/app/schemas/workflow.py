from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


WorkflowAction = Literal[
    "SUBMIT",
    "START_REVIEW",
    "RETURN",
    "APPROVE",
    "REJECT",
]


class WorkflowTransitionRequest(BaseModel):

    action: WorkflowAction

    comment: str | None = Field(
        default=None,
        max_length=500,
    )


class WorkflowEventResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int

    project_id: int

    action: str

    previous_status: str

    new_status: str

    comment: str | None

    actor_reference: str

    created_at: datetime


class WorkflowTransitionResponse(BaseModel):

    project_id: int

    previous_status: str

    current_status: str

    action: str

    event_id: int

    message: str