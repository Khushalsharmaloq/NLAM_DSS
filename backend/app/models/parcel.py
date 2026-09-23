from datetime import datetime, timezone
from decimal import Decimal

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKBElement

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Parcel(Base):

    __tablename__ = "land_parcels"

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "village",
            "survey_number",
            name="uq_project_parcel_survey",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False,
        index=True,
    )

    survey_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    village: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    land_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    area_ha: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
    )

    acquisition_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PROPOSED",
    )

    geom: Mapped[WKBElement] = mapped_column(
        Geometry(
            geometry_type="POLYGON",
            srid=4326,
            spatial_index=True,
        ),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )