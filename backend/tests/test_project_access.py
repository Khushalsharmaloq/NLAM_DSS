"""Object-level authorization checks using only the portable project/user tables."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.database import get_db
from app.main import app
from app.models.project import Project
from app.models.user import User


@pytest.fixture
def client_and_users():
    engine = create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=StaticPool)
    User.__table__.create(engine)
    Project.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            Project(name="Own project", state="Uttar Pradesh", district="Lucknow",
                    proposed_area_ha=2, owner_username="one", status="DRAFT"),
            Project(name="Other officer", state="Uttar Pradesh", district="Lucknow",
                    proposed_area_ha=3, owner_username="two", status="SUBMITTED"),
            Project(name="Other district", state="Uttar Pradesh", district="Kanpur",
                    proposed_area_ha=4, owner_username="two", status="DRAFT"),
            Project(name="Other state", state="Bihar", district="Patna",
                    proposed_area_ha=5, owner_username="three", status="DRAFT"),
        ])
        db.commit()
    actor = [User(id=100, username="one", full_name="Officer One", role="PROJECT_OFFICER",
                  state="Uttar Pradesh", district="Lucknow", hashed_password="test", is_active=True,
                  created_at=datetime.now(timezone.utc))]

    def session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = session_override
    app.dependency_overrides[get_current_user] = lambda: actor[0]
    yield TestClient(app), actor
    app.dependency_overrides.clear()
    engine.dispose()


def test_officer_only_sees_owned_projects(client_and_users):
    client, _ = client_and_users
    assert [p["id"] for p in client.get("/api/v1/projects").json()] == [1]
    assert client.get("/api/v1/projects/1").status_code == 200
    for endpoint in ("", "/parcels", "/notifications", "/awards", "/workflow",
                     "/documents", "/milestones", "/audit"):
        assert client.get(f"/api/v1/projects/2{endpoint}").status_code == 404


def test_jurisdiction_changes_visible_projects(client_and_users):
    client, actor = client_and_users
    actor[0].role = "DISTRICT_AUTHORITY"
    assert [p["id"] for p in client.get("/api/v1/projects").json()] == [2, 1]
    assert client.get("/api/v1/projects/3").status_code == 404
    actor[0].role = "STATE_AUTHORITY"
    assert [p["id"] for p in client.get("/api/v1/projects").json()] == [3, 2, 1]
    actor[0].role = "CENTRAL_MINISTRY"
    assert len(client.get("/api/v1/projects").json()) == 4


def test_officer_cannot_record_award_even_when_project_is_missing(client_and_users):
    client, _ = client_and_users
    body = {"notification_id": 1, "parcel_id": 1, "reference": "A-1",
            "award_date": "2026-09-23", "amount": "100.00"}
    assert client.post("/api/v1/projects/999/awards", json=body).status_code == 403


def test_project_state_and_district_cannot_escape_assignment(client_and_users):
    client, _ = client_and_users
    body = {"name": "Another proposal", "state": "Bihar", "district": "Patna",
            "proposed_area_ha": "1.0000"}
    assert client.post("/api/v1/projects", json=body).status_code == 403
    body.update(state="Uttar Pradesh", district="Lucknow")
    response = client.post("/api/v1/projects", json=body)
    assert response.status_code == 201, response.text
    assert response.json()["owner_username"] == "one"
