import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project

from app.schemas.parcel import (
    ParcelCreate,
    ParcelResponse,
)


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Land Parcels"],
)


PARCEL_SELECT = """
    SELECT
        id,
        project_id,
        survey_number,
        village,
        land_type,
        area_ha,
        acquisition_status,
        ST_AsGeoJSON(geom) AS geometry,
        created_at

    FROM land_parcels
"""


def serialize_parcel(row):

    record = dict(row)

    geometry = record["geometry"]

    if isinstance(geometry, str):
        record["geometry"] = json.loads(geometry)

    return record


def find_project(db: Session, project_id: int):

    project = db.get(Project, project_id)

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )

    return project


@router.post(
    "/{project_id}/parcels",
    response_model=ParcelResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_parcel(
    project_id: int,
    payload: ParcelCreate,
    db: Session = Depends(get_db),
):

    find_project(db, project_id)

    geometry_json = json.dumps(
        payload.geometry.model_dump()
    )

    geometry_sql = """
        ST_SetSRID(
            ST_GeomFromGeoJSON(:geometry),
            4326
        )
    """

    validation = db.execute(
        text(
            f"""
            SELECT
                ST_IsValid({geometry_sql}) AS valid,
                ST_IsEmpty({geometry_sql}) AS empty,
                ST_Area(
                    {geometry_sql}::geography
                ) / 10000 AS area_ha
            """
        ),
        {"geometry": geometry_json},
    ).mappings().one()

    if (
        not validation["valid"]
        or validation["empty"]
        or validation["area_ha"] <= 0
    ):
        raise HTTPException(
            status_code=422,
            detail="Invalid or empty parcel boundary.",
        )

    try:

        result = db.execute(
            text(
                f"""
                INSERT INTO land_parcels (
                    project_id,
                    survey_number,
                    village,
                    land_type,
                    area_ha,
                    acquisition_status,
                    geom,
                    created_at
                )

                VALUES (
                    :project_id,
                    :survey_number,
                    :village,
                    :land_type,
                    :area_ha,
                    'PROPOSED',
                    {geometry_sql},
                    NOW()
                )

                RETURNING id
                """
            ),
            {
                "project_id": project_id,
                "survey_number": payload.survey_number,
                "village": payload.village,
                "land_type": payload.land_type,
                "area_ha": validation["area_ha"],
                "geometry": geometry_json,
            },
        )

        parcel_id = result.scalar_one()

        db.commit()

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "A parcel with this survey number "
                "already exists in the village and project."
            ),
        )

    return get_parcel(
        project_id,
        parcel_id,
        db,
    )


@router.get(
    "/{project_id}/parcels",
    response_model=list[ParcelResponse],
)
def list_parcels(
    project_id: int,
    db: Session = Depends(get_db),
):

    find_project(db, project_id)

    rows = db.execute(
        text(
            PARCEL_SELECT +
            " WHERE project_id = :project_id ORDER BY id DESC"
        ),
        {"project_id": project_id},
    ).mappings().all()

    return [serialize_parcel(row) for row in rows]


@router.get(
    "/{project_id}/parcels/geojson",
)
def project_parcel_geojson(
    project_id: int,
    db: Session = Depends(get_db),
):

    parcels = list_parcels(project_id, db)

    features = []

    for parcel in parcels:

        features.append(
            {
                "type": "Feature",
                "id": parcel["id"],
                "geometry": parcel["geometry"],
                "properties": {
                    "parcel_id": parcel["id"],
                    "survey_number": parcel["survey_number"],
                    "village": parcel["village"],
                    "land_type": parcel["land_type"],
                    "area_ha": float(parcel["area_ha"]),
                    "acquisition_status": parcel[
                        "acquisition_status"
                    ],
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get(
    "/{project_id}/parcels/{parcel_id}",
    response_model=ParcelResponse,
)
def get_parcel(
    project_id: int,
    parcel_id: int,
    db: Session = Depends(get_db),
):

    find_project(db, project_id)

    row = db.execute(
        text(
            PARCEL_SELECT +
            """
            WHERE project_id = :project_id
            AND id = :parcel_id
            """
        ),
        {
            "project_id": project_id,
            "parcel_id": parcel_id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Parcel not found.",
        )

    return serialize_parcel(row)