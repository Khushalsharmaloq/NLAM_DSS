import math

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PolygonGeometry(BaseModel):

    type: Literal["Polygon"]

    coordinates: list[list[list[float]]]

    @model_validator(mode="after")
    def validate_polygon(self):

        if not self.coordinates:
            raise ValueError("Polygon must contain a boundary.")

        for ring in self.coordinates:

            if len(ring) > 1000:
                raise ValueError("A polygon ring may contain at most 1000 points.")

            if len(ring) < 4:
                raise ValueError(
                    "Polygon ring must contain at least four positions."
                )

            for point in ring:

                if len(point) != 2:
                    raise ValueError(
                        "Each position must contain longitude and latitude."
                    )

                longitude, latitude = point

                if not all(
                    math.isfinite(value)
                    for value in (longitude, latitude)
                ):
                    raise ValueError(
                        "Coordinates must be finite numbers."
                    )

                if not -180 <= longitude <= 180:
                    raise ValueError("Invalid longitude.")

                if not -90 <= latitude <= 90:
                    raise ValueError("Invalid latitude.")

            if ring[0] != ring[-1]:
                raise ValueError(
                    "Polygon rings must be closed."
                )

        return self


class ParcelCreate(BaseModel):

    survey_number: str = Field(
        min_length=1,
        max_length=100,
    )

    village: str = Field(
        min_length=2,
        max_length=150,
    )

    land_type: str = Field(
        min_length=2,
        max_length=50,
    )

    geometry: PolygonGeometry


class ParcelResponse(BaseModel):

    id: int

    project_id: int

    survey_number: str

    village: str

    land_type: str

    area_ha: Decimal

    acquisition_status: str

    geometry: dict

    created_at: datetime
