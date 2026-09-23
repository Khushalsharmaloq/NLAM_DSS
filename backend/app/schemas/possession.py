from typing import Literal

from pydantic import BaseModel, Field


ProgressAction = Literal[
    "RECORD_SURVEY",
    "RECORD_DOCUMENTATION",
    "RECORD_POSSESSION",
]


class ParcelProgressRequest(BaseModel):
    action: ProgressAction

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )