from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


ImpactType = Literal[
    "PHYSICAL",
    "ECONOMIC",
    "BOTH",
]

AssistanceType = Literal[
    "HOUSING",
    "LIVELIHOOD",
    "FINANCIAL",
    "COMBINED",
    "TO_BE_ASSESSED",
]


class RRHouseholdCreate(BaseModel):
    household_reference: str = Field(
        min_length=3,
        max_length=40,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
    )

    village: str = Field(
        min_length=2,
        max_length=100,
    )

    parcel_id: int | None = Field(
        default=None,
        gt=0,
    )

    affected_persons: int = Field(
        ge=1,
        le=100,
    )

    impact_type: ImpactType

    relocation_required: bool

    assistance_type: AssistanceType

    indicative_assistance_inr: Decimal = Field(
        ge=0,
        max_digits=18,
        decimal_places=2,
    )

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )


class RRHouseholdResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    parcel_id: int | None
    household_reference: str
    village: str
    affected_persons: int
    impact_type: str
    relocation_required: bool
    assistance_type: str
    indicative_assistance_inr: Decimal
    remarks: str | None
    created_by_username: str
    created_at: datetime