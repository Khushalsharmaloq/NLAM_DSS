-- Additive milestone 2 migration: does not modify or delete legacy tables.
-- Apply once with psql -v ON_ERROR_STOP=1; re-running is safe.
BEGIN;
CREATE TABLE IF NOT EXISTS acquisition_notifications (
 id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id),
 reference VARCHAR(100) NOT NULL, notification_type VARCHAR(100) NOT NULL,
 legal_framework VARCHAR(200) NOT NULL, notification_date DATE NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','RECORDED')),
 notes TEXT, actor_reference VARCHAR(100) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT uq_notification_project_reference UNIQUE(project_id,reference));
CREATE INDEX IF NOT EXISTS ix_acquisition_notifications_project_id ON acquisition_notifications(project_id);
CREATE TABLE IF NOT EXISTS notification_parcels (
 id SERIAL PRIMARY KEY, notification_id INTEGER NOT NULL REFERENCES acquisition_notifications(id),
 parcel_id INTEGER NOT NULL REFERENCES land_parcels(id),
 CONSTRAINT uq_notification_parcel UNIQUE(notification_id,parcel_id));
CREATE INDEX IF NOT EXISTS ix_notification_parcels_notification_id ON notification_parcels(notification_id);
CREATE INDEX IF NOT EXISTS ix_notification_parcels_parcel_id ON notification_parcels(parcel_id);
CREATE TABLE IF NOT EXISTS acquisition_awards (
 id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id),
 notification_id INTEGER NOT NULL REFERENCES acquisition_notifications(id),
 parcel_id INTEGER NOT NULL REFERENCES land_parcels(id),
 reference VARCHAR(100) NOT NULL, award_date DATE NOT NULL,
 amount NUMERIC(16,2) NOT NULL CHECK(amount >= 0), notes TEXT,
 actor_reference VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT uq_award_project_reference UNIQUE(project_id,reference));
CREATE INDEX IF NOT EXISTS ix_acquisition_awards_project_id ON acquisition_awards(project_id);
CREATE INDEX IF NOT EXISTS ix_acquisition_awards_notification_id ON acquisition_awards(notification_id);
CREATE INDEX IF NOT EXISTS ix_acquisition_awards_parcel_id ON acquisition_awards(parcel_id);
COMMIT;
