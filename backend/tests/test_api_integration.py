"""Initial API integration checks using the isolated nlam_test database."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url


# Verify the target BEFORE importing app.main. Its startup creates tables
# in the database selected by DATABASE_URL.
database_url = os.environ.get("DATABASE_URL")

if not database_url:
    raise RuntimeError("STOP: DATABASE_URL is missing.")

if make_url(database_url).database != "nlam_test":
    raise RuntimeError("STOP: API integration tests require nlam_test.")

from app.database import engine

with engine.connect() as connection:
    actual_database = connection.execute(
        text("SELECT current_database()")
    ).scalar_one()

if actual_database != "nlam_test":
    raise RuntimeError("STOP: Connection is not using nlam_test.")


from app.main import app


@pytest.fixture(scope="module")
def client():
    # Entering TestClient runs the application's startup procedure.
    with TestClient(app) as test_client:
        yield test_client


def test_database_is_isolated():
    with engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()

        postgis_version = connection.execute(
            text("SELECT PostGIS_Version()")
        ).scalar_one()

    assert database_name == "nlam_test"
    assert postgis_version


def test_api_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["database"] == "connected"


def test_workflow_requires_authentication(client):
    response = client.get("/api/v1/projects/3/workflow")

    assert response.status_code == 401
