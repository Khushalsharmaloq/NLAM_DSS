-- Additive upgrade for existing local databases. Fresh installations use the ORM.
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_username VARCHAR(80);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agency VARCHAR(180);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sector VARCHAR(80);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS supersedes_id INTEGER REFERENCES project_documents(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_supersedes_id ON project_documents(supersedes_id) WHERE supersedes_id IS NOT NULL;
ALTER TABLE rr_households ADD COLUMN IF NOT EXISTS progress_status VARCHAR(25) NOT NULL DEFAULT 'IDENTIFIED';
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS recorded_by_username VARCHAR(80);
CREATE INDEX IF NOT EXISTS ix_projects_owner_username ON projects(owner_username);
-- Existing unscopeable prototype records go to the existing demonstration officer.
UPDATE projects SET owner_username = 'project.officer' WHERE owner_username IS NULL;
UPDATE users SET state = 'Uttar Pradesh' WHERE role IN ('PROJECT_OFFICER', 'STATE_AUTHORITY', 'DISTRICT_AUTHORITY') AND state IS NULL;
UPDATE users SET district = 'Lucknow' WHERE role = 'DISTRICT_AUTHORITY' AND district IS NULL;
