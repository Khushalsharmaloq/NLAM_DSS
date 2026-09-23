"""Acquisition API authorization tests; no acquisition records are created."""

import os
from types import SimpleNamespace

from sqlalchemy.engine import make_url

# Check the database target before importing the application.
database_url = os.environ.get("DATABASE_URL")
if not database_url or make_url(database_url).database != "nlam_test":
    raise RuntimeError("STOP: Acquisition tests require nlam_test.")

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.core.project_access_dependency import get_accessible_project
from app.main import app


NOTIFICATION_BODY = {
    "reference": "AUTH-TEST-NOT",
    "notification_type": "Preliminary notification",
    "legal_framework": "Synthetic test framework",
    "notification_date": "2026-09-23",
    "status": "DRAFT",
    "parcel_ids": [1],
}

AWARD_BODY = {
    "notification_id": 1,
    "parcel_id": 1,
    "reference": "AUTH-TEST-AWARD",
    "award_date": "2026-09-23",
    "amount": "100.00",
}


@pytest.fixture
def client():
    # Ensure a previous test cannot leave an authentication override behind.
    app.dependency_overrides.pop(get_current_user, None)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/projects/1/notifications",
        "/api/v1/projects/1/awards",
    ],
)
def test_acquisition_get_requires_login(client, path):
    response = client.get(path)
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/v1/projects/1/notifications", NOTIFICATION_BODY),
        ("/api/v1/projects/1/awards", AWARD_BODY),
    ],
)
def test_project_officer_cannot_create_acquisition_records(
    client, path, body
):
    # Override authentication only. Keep the real role-check dependency.
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        username="test.project.officer",
        role="PROJECT_OFFICER",
    )

    # Isolate the role check: project access is tested separately.
    # This override exists only for the duration of this request.
    app.dependency_overrides[get_accessible_project] = (
        lambda: SimpleNamespace(id=1)
    )
    try:
        response = client.post(path, json=body)
    finally:
        app.dependency_overrides.pop(get_accessible_project, None)

    assert response.status_code == 403
