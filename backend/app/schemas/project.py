from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):

    name: str = Field(
        min_length=3,
        max_length=250,
    )

    state: str = Field(
        min_length=2,
        max_length=100,
    )

    district: str = Field(
        min_length=2,
        max_length=100,
    )

    proposed_area_ha: Decimal = Field(
        gt=0,
        max_digits=14,
        decimal_places=4,
    )

    agency: str | None = Field(default=None, max_length=180)
    sector: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    target_date: date | None = None


class ProjectResponse(ProjectCreate):

    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int

    status: str

    owner_username: str | None

    created_at: datetime
