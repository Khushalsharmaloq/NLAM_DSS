BEGIN;

-- A user's jurisdiction is assigned explicitly.
-- NULL means no jurisdiction has been assigned yet.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS assigned_state VARCHAR(100);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS assigned_district VARCHAR(100);

-- Explicit project assignments for PROJECT_OFFICER accounts.
CREATE TABLE IF NOT EXISTS project_user_assignments (
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    project_id INTEGER NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,

    assigned_by_user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS ix_project_user_assignments_project_id
    ON project_user_assignments(project_id);

COMMIT;