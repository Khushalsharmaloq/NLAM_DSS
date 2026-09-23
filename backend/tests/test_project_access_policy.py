"""Unit tests for the shared project-access policy."""

from types import SimpleNamespace

import pytest

from app.core.project_access import can_access_project


@pytest.mark.parametrize(
    ("role", "assigned_state", "assigned_district",
     "project_state", "project_district", "assigned", "expected"),
    [
        # System administrator: access does not depend on jurisdiction.
        ("SYSTEM_ADMIN", None, None, "Maharashtra", "Pune", False, True),

        # State authority: assigned state only.
        ("STATE_AUTHORITY", "Maharashtra", None,
         "Maharashtra", "Pune", False, True),
        ("STATE_AUTHORITY", "Maharashtra", None,
         "Gujarat", "Surat", False, False),
        ("STATE_AUTHORITY", None, None,
         "Maharashtra", "Pune", False, False),

        # District authority: both state and district must match.
        ("DISTRICT_AUTHORITY", "Maharashtra", "Pune",
         "Maharashtra", "Pune", False, True),
        ("DISTRICT_AUTHORITY", "Maharashtra", "Pune",
         "Maharashtra", "Nagpur", False, False),
        ("DISTRICT_AUTHORITY", "Maharashtra", "Pune",
         "Gujarat", "Pune", False, False),
        ("DISTRICT_AUTHORITY", "Maharashtra", None,
         "Maharashtra", "Pune", False, False),

        # Jurisdiction matching is case-insensitive and ignores edge spaces.
        ("DISTRICT_AUTHORITY", " maharashtra ", " PUNE ",
         "Maharashtra", "Pune", False, True),

        # Project officer: explicit assignment is required.
        ("PROJECT_OFFICER", None, None,
         "Maharashtra", "Pune", True, True),
        ("PROJECT_OFFICER", None, None,
         "Maharashtra", "Pune", False, False),
        ("PROJECT_OFFICER", "Gujarat", "Surat",
         "Maharashtra", "Pune", True, True),
        ("PROJECT_OFFICER", "Maharashtra", "Pune",
         "Maharashtra", "Pune", False, False),

        # Unknown roles are denied.
        ("UNKNOWN_ROLE", "Maharashtra", "Pune",
         "Maharashtra", "Pune", True, False),
    ],
)
def test_project_access_policy(
    role,
    assigned_state,
    assigned_district,
    project_state,
    project_district,
    assigned,
    expected,
):
    user = SimpleNamespace(
        role=role,
        assigned_state=assigned_state,
        assigned_district=assigned_district,
    )

    project = SimpleNamespace(
        state=project_state,
        district=project_district,
    )

    assert can_access_project(
        user,
        project,
        has_project_assignment=assigned,
    ) is expected
