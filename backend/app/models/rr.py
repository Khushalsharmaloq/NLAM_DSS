from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.parcel import Parcel


class RRHousehold(Base):
    __tablename__ = "rr_households"

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "household_reference",
            name="uq_rr_household_project_reference",
        ),
    )

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

    parcel_id: Mapped[int | None] = mapped_column(
        ForeignKey(f"{Parcel.__tablename__}.id"),
        nullable=True,
    )

    household_reference: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    village: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    affected_persons: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    impact_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    relocation_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )

    assistance_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    indicative_assistance_inr: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    progress_status: Mapped[str] = mapped_column(
        String(25), nullable=False, default="IDENTIFIED"
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
