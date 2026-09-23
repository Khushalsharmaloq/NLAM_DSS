from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotificationCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=100)
    notification_type: str = Field(min_length=1, max_length=100)
    legal_framework: str = Field(min_length=1, max_length=200)
    notification_date: date
    status: str = Field(default='DRAFT', pattern='^(DRAFT|RECORDED)$')
    parcel_ids: list[int] = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator('reference', 'notification_type', 'legal_framework')
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Cannot be blank')
        return value

    @field_validator('parcel_ids')
    @classmethod
    def unique_parcels(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value) or any(item <= 0 for item in value):
            raise ValueError('Parcel IDs must be positive and unique')
        return value


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    reference: str
    notification_type: str
    legal_framework: str
    notification_date: date
    status: str
    parcel_ids: list[int]
    notes: str | None
    actor_reference: str
    created_at: datetime


class AwardCreate(BaseModel):
    notification_id: int = Field(gt=0)
    parcel_id: int = Field(gt=0)
    reference: str = Field(min_length=1, max_length=100)
    award_date: date
    amount: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator('reference')
    @classmethod
    def nonblank_reference(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Reference cannot be blank')
        return value


class AwardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    notification_id: int
    parcel_id: int
    reference: str
    award_date: date
    amount: Decimal
    notes: str | None
    actor_reference: str
    created_at: datetime
