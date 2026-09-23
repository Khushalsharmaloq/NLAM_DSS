"""Database-backed project assignment test using nlam_test only."""

import os
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


# Check the configured database BEFORE importing application modules.
database_url = os.environ.get("DATABASE_URL")

if not database_url or make_url(database_url).database != "nlam_test":
    raise RuntimeError("STOP: Assignment tests require nlam_test.")


from app.core.project_access_db import can_access_project_in_db
from app.database import engine


def test_project_officer_can_access_only_assigned_project():
    suffix = uuid4().hex[:12]

    with engine.connect() as connection:
        actual_database = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()

        assert actual_database == "nlam_test"

        connection.rollback()
        transaction = connection.begin()

        try:
            # Create an isolated test user and two projects.
            user_id = connection.execute(
                text("""
                    INSERT INTO users (
                        username, full_name, hashed_password,
                        role, is_active
                    )
                    VALUES (
                        :username, 'Assignment Test Officer',
                        'not-a-real-password-hash',
                        'PROJECT_OFFICER', TRUE
                    )
                    RETURNING id
                """),
                {"username": f"assignment.test.{suffix}"},
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
                    {"name": f"Assignment test {suffix}-{number}"},
                ).scalar_one()

                project_ids.append(project_id)

            assigned_project_id, unassigned_project_id = project_ids

            # Assign this officer to the first project only.
            connection.execute(
                text("""
                    INSERT INTO project_user_assignments (
                        user_id, project_id
                    )
                    VALUES (:user_id, :project_id)
                """),
                {
                    "user_id": user_id,
                    "project_id": assigned_project_id,
                },
            )

            officer = SimpleNamespace(
                id=user_id,
                role="PROJECT_OFFICER",
            )

            assigned_project = SimpleNamespace(
                id=assigned_project_id,
                state="Test State",
                district="Test District",
            )

            unassigned_project = SimpleNamespace(
                id=unassigned_project_id,
                state="Test State",
                district="Test District",
            )

            # Use the same connection so the helper can see
            # the uncommitted test records.
            with Session(bind=connection) as db:
                assert can_access_project_in_db(
                    db, officer, assigned_project
                ) is True

                assert can_access_project_in_db(
                    db, officer, unassigned_project
                ) is False

                assert can_access_project_in_db(
                    db,
                    SimpleNamespace(role="PROJECT_OFFICER"),
                    assigned_project,
                ) is False

        finally:
            # Remove every test record, including on assertion failure.
            transaction.rollback()
