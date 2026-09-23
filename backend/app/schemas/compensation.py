from datetime import datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class CompensationEstimateCreate(BaseModel):
    parcel_id: int = Field(gt=0)

    proposed_area_ha: Decimal = Field(
        gt=0,
        max_digits=14,
        decimal_places=4,
    )

    indicative_rate_per_ha: Decimal = Field(
        gt=0,
        max_digits=18,
        decimal_places=2,
    )

    additional_planning_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=18,
        decimal_places=2,
    )

    remarks: str | None = Field(
        default=None,
        max_length=500,
    )


class CompensationEstimateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    parcel_id: int

    proposed_area_ha: Decimal
    indicative_rate_per_ha: Decimal
    additional_planning_amount: Decimal
    estimated_total: Decimal

    remarks: str | None
    created_by_username: str
    created_at: datetime