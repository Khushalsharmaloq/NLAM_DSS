from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHANGES = {}


def load(relative_path):
    path = ROOT / relative_path

    if not path.exists():
        raise RuntimeError(
            f"Required file not found: {relative_path}"
        )

    return path.read_text(encoding="utf-8")


def replace_once(source, old, new, description):
    count = source.count(old)

    if count != 1:
        raise RuntimeError(
            f"{description}: expected one matching section, "
            f"found {count}. No files have been modified."
        )

    return source.replace(old, new, 1)


# ============================================
# 1. PROJECT API
# ============================================

path = "backend/app/routers/projects.py"

source = load(path)

source = replace_once(
    source,
    "from app.database import get_db",
    (
        "from app.core.dependencies import "
        "get_current_user, require_roles\n"
        "from app.database import get_db"
    ),
    "Project API authentication import",
)

source = replace_once(
    source,
    '    tags=["Projects"],',
    (
        '    tags=["Projects"],\n'
        '    dependencies=[Depends(get_current_user)],'
    ),
    "Project API authentication",
)

source = replace_once(
    source,
    """def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
):""",
    """def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("PROJECT_OFFICER")),
):""",
    "Project creation authorization",
)

CHANGES[path] = source


# ============================================
# 2. LAND PARCEL AND GIS API
# ============================================

path = "backend/app/routers/parcels.py"

source = load(path)

source = replace_once(
    source,
    "from app.database import get_db",
    (
        "from app.core.dependencies import "
        "get_current_user, require_roles\n"
        "from app.database import get_db"
    ),
    "Parcel API authentication import",
)

source = replace_once(
    source,
    '    tags=["Land Parcels"],',
    (
        '    tags=["Land Parcels"],\n'
        '    dependencies=[Depends(get_current_user)],'
    ),
    "Parcel API authentication",
)

source = replace_once(
    source,
    """def create_parcel(
    project_id: int,
    payload: ParcelCreate,
    db: Session = Depends(get_db),
):""",
    """def create_parcel(
    project_id: int,
    payload: ParcelCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_roles("PROJECT_OFFICER")),
):""",
    "Parcel creation authorization",
)

CHANGES[path] = source


# ============================================
# 3. PROJECT WORKFLOW API
# ============================================

path = "backend/app/routers/workflow.py"

source = load(path)

source = replace_once(
    source,
    "from app.database import get_db",
    (
        "from app.core.dependencies import get_current_user\n"
        "from app.database import get_db"
    ),
    "Workflow authentication import",
)

source = replace_once(
    source,
    '    tags=["Project Workflow"],',
    (
        '    tags=["Project Workflow"],\n'
        '    dependencies=[Depends(get_current_user)],'
    ),
    "Workflow API authentication",
)

# Define the role permitted to perform each action.

role_rules = '''
ACTION_ROLES = {
    "SUBMIT": {"PROJECT_OFFICER"},
    "START_REVIEW": {"DISTRICT_AUTHORITY"},
    "RETURN": {"DISTRICT_AUTHORITY"},
    "APPROVE": {"STATE_AUTHORITY"},
    "REJECT": {"STATE_AUTHORITY"},
}


TRANSITIONS = {
'''

source = replace_once(
    source,
    "TRANSITIONS = {",
    role_rules.strip("\n"),
    "Workflow action permissions",
)

# Retrieve the authenticated user during transitions.

source = replace_once(
    source,
    """def transition_project(
    project_id: int,
    payload: WorkflowTransitionRequest,
    db: Session = Depends(get_db),
):""",
    """def transition_project(
    project_id: int,
    payload: WorkflowTransitionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):""",
    "Workflow transition authentication",
)

# Enforce authorization before modifying the project.

source = replace_once(
    source,
    """    # Lock the project record while evaluating and""",
    """    permitted_roles = ACTION_ROLES[payload.action]

    if current_user.role not in permitted_roles:
        raise HTTPException(
            status_code=403,
            detail=(
                "Your role does not permit "
                "this workflow action."
            ),
        )

    # Lock the project record while evaluating and""",
    "Workflow action authorization",
)

# Attribute new workflow events to the actual user.

source = replace_once(
    source,
    '        actor_reference="DEMO_OPERATOR",',
    '        actor_reference=current_user.username,',
    "Authenticated workflow attribution",
)

CHANGES[path] = source


# ============================================
# 4. SAVE VERIFIED CHANGES
# ============================================

# All matching sections have been checked before
# any source file is modified.

for relative_path, content in CHANGES.items():

    path = ROOT / relative_path

    path.write_text(
        content,
        encoding="utf-8",
        newline="\n",
    )

    print(f"Updated: {relative_path}")


print()
print("API authorization changes applied successfully.")
print("Existing project, parcel and workflow data preserved.")