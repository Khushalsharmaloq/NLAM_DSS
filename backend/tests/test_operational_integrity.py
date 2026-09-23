"""Money and document-version invariants through the actual HTTP routes."""
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.database import get_db
from app.main import app
from app.models.acquisition import AcquisitionAward
from app.models.document import ProjectDocument
from app.models.operations import CompensationPayment
from app.models.project import Project
from app.models.user import User


@pytest.fixture
def client_and_actor(tmp_path, monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=StaticPool)
    for table in (User.__table__, Project.__table__, AcquisitionAward.__table__,
                  CompensationPayment.__table__, ProjectDocument.__table__):
        table.create(engine)
    with Session(engine) as db:
        db.add(Project(name="Test project", state="Uttar Pradesh", district="Lucknow",
            proposed_area_ha=1, status="APPROVED", owner_username="officer"))
        db.add(AcquisitionAward(project_id=1, notification_id=1, parcel_id=1,
            reference="AW-1", award_date=date(2026, 9, 23), amount=100,
            actor_reference="district"))
        db.commit()
    actor = User(id=99, username="admin", full_name="Test admin", role="SYSTEM_ADMIN",
        hashed_password="test", is_active=True, state=None, district=None,
        created_at=datetime.now(timezone.utc))

    def get_session():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = get_session
    app.dependency_overrides[get_current_user] = lambda: actor
    import app.routers.documents as document_routes
    monkeypatch.setattr(document_routes, "STORAGE_DIR", tmp_path)
    yield TestClient(app), actor
    app.dependency_overrides.clear()
    engine.dispose()


def test_payment_cannot_exceed_award(client_and_actor):
    client, _ = client_and_actor
    path = "/api/v1/projects/1/payments"
    body = {"award_id": 1, "reference": "TX-1", "payment_date": "2026-09-23", "amount": "60.00"}
    assert client.post(path, json=body).status_code == 201
    body.update(reference="TX-2", amount="41.00")
    assert client.post(path, json=body).status_code == 409
    body.update(amount="40.00")
    assert client.post(path, json=body).status_code == 201
    assert len(client.get(path).json()) == 2
    body.update(reference="TX-3", amount="0.01")
    assert client.post(path, json=body).status_code == 409


def test_document_version_chain_cannot_branch(client_and_actor):
    client, actor = client_and_actor
    actor.role = "PROJECT_OFFICER"
    actor.username = "officer"
    actor.state = "Uttar Pradesh"
    path = "/api/v1/projects/1/documents"
    def upload(name, replaces=None):
        data = {"document_type": "PROPOSAL"}
        if replaces:
            data["replaces_document_id"] = str(replaces)
        return client.post(path, data=data,
            files={"file": (name, b"\x89PNG\r\n\x1a\ntrace", "image/png")})
    first = upload("initial.png")
    assert first.status_code == 201, first.text
    first_id = first.json()["id"]
    second = upload("revision.png", first_id)
    assert second.status_code == 201, second.text
    assert second.json()["version"] == 2
    assert second.json()["supersedes_id"] == first_id
    assert upload("branch.png", first_id).status_code == 409
    assert len(client.get(path).json()) == 2
