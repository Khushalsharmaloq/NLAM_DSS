"""Verify that a notification cannot reference another project's parcel."""

import os
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url


# Protect the live database BEFORE importing the application.
database_url = os.environ.get("DATABASE_URL")

if not database_url or make_url(database_url).database != "nlam_test":
    raise RuntimeError("STOP: Cross-project tests require nlam_test.")


from app.core.dependencies import get_current_user
from app.database import engine
from app.main import app


@pytest.fixture
def client():
    app.dependency_overrides.pop(get_current_user, None)

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_notification_rejects_parcel_from_another_project(client):
    # Verify the actual connection before inserting test records.
    with engine.connect() as connection:
        assert connection.execute(
            text("SELECT current_database()")
        ).scalar_one() == "nlam_test"

    suffix = uuid4().hex[:12]
    project_ids = []
    parcel_id = None
    reference = f"CROSS-PROJECT-{suffix}"

    try:
        # Create two independent approved demonstration projects.
        with engine.begin() as connection:
            for number in (1, 2):
                project_id = connection.execute(
                    text("""
                        INSERT INTO projects
                            (name, state, district, proposed_area_ha,
                             status, created_at)
                        VALUES
                            (:name, 'Test State', 'Test District',
                             1.0000, 'APPROVED', NOW())
                        RETURNING id
                    """),
                    {"name": f"Cross-project test {suffix}-{number}"},
                ).scalar_one()

                project_ids.append(project_id)

            # This parcel belongs ONLY to the second project.
            parcel_id = connection.execute(
                text("""
                    INSERT INTO land_parcels
                        (project_id, survey_number, village, land_type,
                         area_ha, acquisition_status, geom, created_at)
                    VALUES
                        (:project_id, :survey_number, 'Test Village',
                         'AGRICULTURAL', 1.0000, 'PROPOSED',
                         ST_GeomFromText(
                             'POLYGON((73 18, 73.001 18, 73.001 18.001, 73 18.001, 73 18))',
                             4326
                         ),
                         NOW())
                    RETURNING id
                """),
                {
                    "project_id": project_ids[1],
                    "survey_number": f"TEST-{suffix}",
                },
            ).scalar_one()

        # Override authentication but retain the real role and
        # project/parcel validation logic.
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            username="test.state.authority",
            role="STATE_AUTHORITY",
            assigned_state="Test State",
        )

        response = client.post(
            f"/api/v1/projects/{project_ids[0]}/notifications",
            json={
                "reference": reference,
                "notification_type": "Preliminary notification",
                "legal_framework": "Synthetic test framework",
                "notification_date": "2026-09-23",
                "status": "DRAFT",
                "parcel_ids": [parcel_id],
            },
        )

        assert response.status_code == 422, response.text
        assert (
            response.json()["detail"]
            == "All selected parcels must belong to this project."
        )

        # A rejected request must not create a notification.
        with engine.connect() as connection:
            saved_count = connection.execute(
                text("""
                    SELECT COUNT(*)
                    FROM acquisition_notifications
                    WHERE project_id = :project_id
                      AND reference = :reference
                """),
                {
                    "project_id": project_ids[0],
                    "reference": reference,
                },
            ).scalar_one()

        assert saved_count == 0

    finally:
        app.dependency_overrides.pop(get_current_user, None)

        # Remove only the records created by this test.
        with engine.begin() as connection:
            if parcel_id is not None:
                connection.execute(
                    text("DELETE FROM land_parcels WHERE id = :id"),
                    {"id": parcel_id},
                )

            for project_id in reversed(project_ids):
                connection.execute(
                    text("DELETE FROM projects WHERE id = :id"),
                    {"id": project_id},
                )
