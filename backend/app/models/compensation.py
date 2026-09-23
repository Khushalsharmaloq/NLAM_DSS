from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.parcel import Parcel


class CompensationEstimate(Base):
    __tablename__ = "compensation_estimates"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        nullable=False,
        index=True,
    )

    parcel_id: Mapped[int] = mapped_column(
        ForeignKey(f"{Parcel.__tablename__}.id"),
        nullable=False,
        index=True,
    )

    proposed_area_ha: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
    )

    indicative_rate_per_ha: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    additional_planning_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    estimated_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_by_username: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )