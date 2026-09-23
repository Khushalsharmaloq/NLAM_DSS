import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.project_access_dependency import get_accessible_project
from app.database import get_db
from app.models.parcel import ParcelBoundaryRevision
from app.models.project import Project

from app.schemas.parcel import (
    ParcelCreate,
    ParcelBoundaryCorrection,
    ParcelResponse,
)


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Land Parcels"],
    dependencies=[Depends(get_current_user)],
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
    dependencies=[Depends(get_accessible_project)],
    response_model=ParcelResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_parcel(
    project_id: int,
    payload: ParcelCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("PROJECT_OFFICER")),
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
                    recorded_by_username,
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
                    :actor,
                    {geometry_sql},
                    NOW()
                )

                RETURNING id
                """
            ),
            {
                "project_id": project_id,
                "actor": actor.username,
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


@router.patch(
    "/{project_id}/parcels/{parcel_id}/boundary",
    dependencies=[Depends(get_accessible_project)],
    response_model=ParcelResponse,
)
def correct_parcel_boundary(
    project_id: int,
    parcel_id: int,
    payload: ParcelBoundaryCorrection,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("PROJECT_OFFICER")),
):
    """Correct a draft parcel; retain both geometries for project audit."""
    project = db.scalar(
        select(Project).where(Project.id == project_id).with_for_update()
    )
    if project.status not in ("DRAFT", "RETURNED"):
        raise HTTPException(409, "Only draft or returned parcel boundaries can be corrected.")

    previous = db.execute(text("""
        SELECT area_ha, ST_AsGeoJSON(geom)::jsonb AS geometry
        FROM land_parcels
        WHERE id = :parcel_id AND project_id = :project_id
        FOR UPDATE
    """), {"parcel_id": parcel_id, "project_id": project_id}).mappings().first()
    if previous is None:
        raise HTTPException(404, "Parcel not found.")

    # Follow-on records must refer to a stable, verified boundary.
    linked = db.execute(text("""
        SELECT
            EXISTS (SELECT 1 FROM notification_parcels WHERE parcel_id = :parcel_id)
         OR EXISTS (SELECT 1 FROM acquisition_awards WHERE parcel_id = :parcel_id)
         OR EXISTS (SELECT 1 FROM compensation_estimates WHERE parcel_id = :parcel_id)
         OR EXISTS (SELECT 1 FROM rr_households WHERE parcel_id = :parcel_id)
         OR EXISTS (SELECT 1 FROM parcel_progress_events WHERE parcel_id = :parcel_id)
        AS has_linked_records
    """), {"parcel_id": parcel_id}).scalar_one()
    if linked:
        raise HTTPException(409, "This parcel has linked records. Review them before correcting its boundary.")

    geometry_json = json.dumps(payload.geometry.model_dump())
    geometry_sql = "ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326)"
    validation = db.execute(text(f"""
        SELECT ST_IsValid({geometry_sql}) AS valid,
               ST_IsEmpty({geometry_sql}) AS empty,
               ST_Area({geometry_sql}::geography) / 10000 AS area_ha
    """), {"geometry": geometry_json}).mappings().one()
    if not validation["valid"] or validation["empty"] or validation["area_ha"] <= 0:
        raise HTTPException(422, "Invalid or empty parcel boundary.")

    db.execute(text(f"""
        UPDATE land_parcels
        SET geom = {geometry_sql}, area_ha = :area_ha
        WHERE id = :parcel_id AND project_id = :project_id
    """), {"geometry": geometry_json, "area_ha": validation["area_ha"],
           "parcel_id": parcel_id, "project_id": project_id})
    db.add(ParcelBoundaryRevision(
        project_id=project_id, parcel_id=parcel_id,
        previous_geometry=previous["geometry"],
        corrected_geometry=payload.geometry.model_dump(),
        previous_area_ha=previous["area_ha"],
        corrected_area_ha=validation["area_ha"],
        reason=payload.reason, actor_reference=actor.username,
    ))
    db.commit()
    return get_parcel(project_id, parcel_id, db)


@router.get(
    "/{project_id}/parcels",
    dependencies=[Depends(get_accessible_project)],
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
    dependencies=[Depends(get_accessible_project)],
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
    dependencies=[Depends(get_accessible_project)],
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
