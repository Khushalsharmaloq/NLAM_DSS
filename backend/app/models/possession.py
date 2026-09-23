from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.parcel import Parcel


class ParcelProgressEvent(Base):
    __tablename__ = "parcel_progress_events"

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

    action: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    previous_stage: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    new_stage: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    recorded_by_username: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )