"""Integration tests for the shared project-access dependency."""

import os
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

# Verify the configured database before importing application modules.
database_url = os.environ.get("DATABASE_URL")

if not database_url or make_url(database_url).database != "nlam_test":
    raise RuntimeError("STOP: Dependency tests require nlam_test.")

from app.core.project_access_dependency import get_accessible_project
from app.database import engine


def test_project_access_dependency():
    suffix = uuid4().hex[:12]

    with engine.connect() as connection:
        # Start the transaction BEFORE issuing any SQL.
        transaction = connection.begin()

        try:
            actual_database = connection.execute(
                text("SELECT current_database()")
            ).scalar_one()

            assert actual_database == "nlam_test"

            user_id = connection.execute(
                text("""
                    INSERT INTO users (
                        username, full_name, hashed_password,
                        role, is_active
                    )
                    VALUES (
                        :username, 'Dependency Test Officer',
                        'not-a-real-password-hash',
                        'PROJECT_OFFICER', TRUE
                    )
                    RETURNING id
                """),
                {"username": f"access.test.{suffix}"},
            ).scalar_one()

            project_ids = []

            for number in (1, 2):
                project_id = connection.execute(
                    text("""
                        INSERT INTO projects (
                            name, state, district,
                            proposed_area_ha, status, created_at
                        )
                        VALUES (
                            :name, 'Test State', 'Test District',
                            1.0000, 'DRAFT', NOW()
                        )
                        RETURNING id
                    """),
                    {"name": f"Access test {suffix}-{number}"},
                ).scalar_one()

                project_ids.append(project_id)

            assigned_id, unassigned_id = project_ids

            connection.execute(
                text("""
                    INSERT INTO project_user_assignments (
                        user_id, project_id
                    )
                    VALUES (:user_id, :project_id)
                """),
                {
                    "user_id": user_id,
                    "project_id": assigned_id,
                },
            )

            officer = SimpleNamespace(
                id=user_id,
                username=f"access.test.{suffix}",
                role="PROJECT_OFFICER",
            )

            admin = SimpleNamespace(
                role="SYSTEM_ADMIN",
            )

            # Share the transaction so the dependency sees
            # the uncommitted temporary records.
            with Session(bind=connection) as db:
                assigned_project = get_accessible_project(
                    project_id=assigned_id,
                    db=db,
                    current_user=officer,
                )

                assert assigned_project.id == assigned_id

                with pytest.raises(HTTPException) as denied:
                    get_accessible_project(
                        project_id=unassigned_id,
                        db=db,
                        current_user=officer,
                    )

                assert denied.value.status_code == 404

                with pytest.raises(HTTPException) as missing:
                    get_accessible_project(
                        project_id=2147483647,
                        db=db,
                        current_user=officer,
                    )

                assert missing.value.status_code == 404
                assert denied.value.detail == missing.value.detail

                assert get_accessible_project(
                    project_id=assigned_id,
                    db=db,
                    current_user=admin,
                ).id == assigned_id

                assert get_accessible_project(
                    project_id=unassigned_id,
                    db=db,
                    current_user=admin,
                ).id == unassigned_id

        finally:
            transaction.rollback()
