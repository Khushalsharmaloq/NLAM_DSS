# Milestone 2 — Acquisition notification and award demo records

Baseline commit: `811de7c0f95fac810ad14f3cd1cdd58c2920a917`.
This is an **additive prototype milestone**, not an actual government notification, statutory award, legal compliance certification, or payment integration.

## Scope

- New project-level notification records, associated with one or more existing parcels.
- New award records attached to a recorded notification and one of its linked parcels.
- Server-side role checks: DISTRICT_AUTHORITY, STATE_AUTHORITY, SYSTEM_ADMIN can add records to APPROVED projects; authenticated users can read within existing project access conventions.
- Server-side input checks: blank reference, duplicate parcel IDs, invalid parcel/project and notification/project combinations, dates, negative amounts and duplicate references.
- New project detail section; frontend reads and writes actual backend data.
- No existing project, compensation, parcel, R&R, or possession API contract changed. Legacy dashboard values are unchanged; awards are NOT represented as disbursed compensation.

## Database migration and data safety

Before deploying, back up your existing database volume. New tables only: `acquisition_notifications`, `notification_parcels`, `acquisition_awards`. No legacy table changes or dropped columns.

This repository did **not** have an Alembic revision history in the baseline. An additive, idempotent PostgreSQL migration is supplied at `backend/migrations/001_acquisition_records.sql`. Existing startup `Base.metadata.create_all()` also creates new tables on a fresh database; the SQL script provides an explicit, repeatable migration for existing databases. Do not stamp an invented Alembic baseline over your production database.

Run from project root (PowerShell) after bringing up Docker:

```powershell
# Make a local database backup first (do not commit the backup or credentials).
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > nlam_before_milestone2.dump
# Apply additive migration using container's psql client.
Get-Content -Raw .\backend\migrations\001_acquisition_records.sql | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Note: The `pg_dump` output redirects through PowerShell; for reliable binary backups use PowerShell 7.4+ byte-preserving redirection or run the backup inside the database container and copy it with `docker cp`. Never delete the Docker named volumes.

## Start using the established commands

```powershell
docker compose up -d --build
docker compose ps
cd .\frontend\
npm run dev -- --host 127.0.0.1
```

The project details page now contains "Notifications & awards". Use an APPROVED project with existing parcels, log in as district or state authority, save a notification marked RECORDED, then create an award linked to one of its selected parcels. A PROJECT_OFFICER is read-only for these new records; API must return 403 on attempted writes. Records remain after browser refresh and container restart (verify locally).

## API additions

- `GET /api/v1/projects/{project_id}/notifications`
- `POST /api/v1/projects/{project_id}/notifications`
- `GET /api/v1/projects/{project_id}/awards`
- `POST /api/v1/projects/{project_id}/awards`

Existing project access is role-authenticated but not yet jurisdiction-scoped; this must be addressed before production use. Documents, publication evidence, granular notification stage workflow and award approval are future milestones. A RECORDED status is only a user-entered demo status, never evidence of statutory publication.

## Verification status at handoff

- Python syntax compilation: executed successfully.
- New schema unit tests: 9 passed.
- Frontend production build: attempted but unavailable because npm dependencies could not be installed in the isolated environment; do not assume the frontend is verified.
- Docker build/start, migration on live PostgreSQL, new endpoint integration, authorization integration, regression and persistence after restart: NOT RUN (Docker daemon unavailable here). Run locally before presenting.

Local verification commands:

```powershell
cd frontend
npm ci
npm run build
cd ..
docker compose up -d --build
docker compose ps
docker compose exec api python -m compileall -q app
# Run schema tests only if pytest is installed in the backend environment:
cd backend
python -m pytest -q tests/test_acquisition_validation.py
cd ..
```

The Docker backend image does not install pytest or include `backend/tests` by default. Run pytest using your Python development environment, or add a separate test image/command; do not change the production image merely to run tests. To inspect logs: `docker compose logs --tail=100 api`.

## Safe Git workflow

Copy these changes into `feat/sih-final-demo` after reviewing the diff. Keep `.env`, backup dumps, `node_modules`, `dist`, and volume data out of Git. Suggested commit message: `feat: add project-linked acquisition notification and award demo records`.
