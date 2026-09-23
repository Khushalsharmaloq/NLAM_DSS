"""Project visibility policy for the NLAM DSS prototype.

This module defines access decisions only. API and database integration
will be added after the access-control migration is deployed safely.
"""


def can_access_project(
    user,
    project,
    *,
    has_project_assignment: bool = False,
) -> bool:
    """Return whether a user may access a particular project.

    has_project_assignment must be established from the database,
    not accepted from a client request.
    """

    role = getattr(user, "role", None)

    if role == "SYSTEM_ADMIN":
        return True

    if role == "PROJECT_OFFICER":
        return has_project_assignment

    project_state = getattr(project, "state", None)
    assigned_state = getattr(user, "assigned_state", None)

    if not project_state or not assigned_state:
        return False

    state_matches = (
        project_state.strip().casefold()
        == assigned_state.strip().casefold()
    )

    if not state_matches:
        return False

    if role == "STATE_AUTHORITY":
        return True

    if role == "DISTRICT_AUTHORITY":
        project_district = getattr(project, "district", None)
        assigned_district = getattr(user, "assigned_district", None)

        if not project_district or not assigned_district:
            return False

        return (
            project_district.strip().casefold()
            == assigned_district.strip().casefold()
        )

    return False
