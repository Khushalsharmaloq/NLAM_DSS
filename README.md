# NLAM DSS

**National Land Acquisition & Management Decision Support System**

NLAM DSS is a local, role-aware functional prototype for demonstrating
project registration, land-parcel mapping, administrative workflows,
document management, indicative compensation and rehabilitation planning,
parcel-level acquisition progress, and management reporting.

The current system uses synthetic demonstration data. It is not a
production land-administration system and does not issue legal decisions,
compensation awards, payment authorizations, eligibility determinations,
or possession certificates.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| Map interface | Leaflet |
| Backend API | Python 3.12, FastAPI, SQLAlchemy |
| Database | PostgreSQL with PostGIS |
| Authentication | JWT-based login and role-based API permissions |
| Local services | Docker Compose |

## Implemented modules

| Module | Current prototype functionality |
| --- | --- |
| Project register | Create and view projects, including their proposed land area and administrative status |
| Parcel GIS | Register and display project-linked land parcels on a map |
| Authentication | Sign in with local demonstration accounts and access protected pages |
| Administrative workflow | Record project status transitions and view their history |
| Document register | Upload, list, and download supported demonstration project documents |
| Compensation planning | Save parcel-linked indicative estimates and review their history |
| R&R planning | Register synthetic affected-household and assistance-planning records |
| Parcel acquisition progress | Record parcel-specific progress stages with usernames, timestamps, and remarks |
| MIS dashboard | Display project, parcel, compensation-planning, R&R-planning, and progress figures derived from stored records |

The Project Details page provides section navigation for the workflow,
documents, compensation, R&R, parcel progress, and GIS map.

## Prerequisites

This repository has been developed and tested locally on Windows using
PowerShell. The following software is required:

- Docker Desktop with Docker Compose
- Node.js and npm
- A modern web browser

Docker runs the API and PostGIS database. Vite runs the frontend
development server separately.

## Local configuration

The Docker Compose configuration reads database settings and the JWT
signing secret from a local `.env` file in the repository root.

The required variable names are:

    DB_NAME
    DB_USER
    DB_PASSWORD
    JWT_SECRET

Use locally generated, non-public values. Do not commit `.env`,
credentials, JWT secrets, real household information, or uploaded
documents to Git.

The existing development database and its demonstration accounts are
not reproduced merely by cloning this repository. A fresh installation
requires local environment configuration and deliberate setup of any
demonstration users and records.

## Start the application

Open PowerShell in the repository root.

**1. Start the API and database:**

    docker compose up -d

The backend is available at:

    http://127.0.0.1:8001

API documentation:

    http://127.0.0.1:8001/docs

**2. Start the frontend in a separate PowerShell terminal:**

    Set-Location .\frontend
    npm.cmd install
    npm.cmd run dev -- --host 127.0.0.1

Open:

    http://127.0.0.1:5173/

Keep the frontend terminal open while using the development server.

The backend Dockerfile currently runs Uvicorn with `--reload`.
This is a development configuration, not a production deployment setup.

## Check demo readiness

With Docker and the frontend running, execute this command from the
repository root:

    .\scripts\check-demo.ps1

The script checks Docker service visibility, API and database health,
frontend availability, the frontend production build, and authentication
protection on the MIS endpoint.

A successful run ends with:

    DEMO READINESS CHECK PASSED

This readiness check does not create records and does not replace
end-to-end integration or security testing.

For the suggested demonstration sequence, see:

    docs/DEMO_GUIDE.md

## Frontend development commands

Run these commands inside `frontend`:

    npm.cmd run dev
    npm.cmd run build
    npm.cmd run lint

The production build runs TypeScript checks followed by Vite.

## Local data persistence

Docker Compose uses named volumes for the PostgreSQL database and
uploaded project documents. Restarting the API does not intentionally
remove these records.

**Do not run `docker compose down -v` when you want to preserve data.**
The `-v` option removes Compose-managed named volumes.

The frontend development build directory is generated output. The
database and document volumes are operational data, not source-code
artifacts.

## Access and demonstration data

The prototype provides separate Project Officer, District Authority,
State Authority, and System Administrator roles.

Permissions are enforced by backend endpoints; hiding a frontend form
is not itself an authorization control.

The local demonstration accounts and their passwords are not published
in this README. Use accounts configured in your own development
database. Do not place demo passwords in a public repository or
presentation materials.

Project and household records used for demonstrations should be
synthetic. Do not enter real identity numbers, personal contact
details, addresses, bank details, or confidential land records.

## Reporting definitions

The MIS dashboard reports values derived from the current local
database. In particular:

- Proposed project land area is not confirmed acquired area.
- Compensation planning uses the latest saved estimate for each
  parcel when calculating its current indicative total. Earlier
  estimates remain visible as historical planning records.
- Compensation totals are not approved awards or payments.
- R&R figures describe synthetic planning records, not verified
  beneficiary counts, eligibility decisions, or approved benefits.
- Parcel possession progress is a demonstration workflow stage,
  not evidence of legal transfer or a possession certificate.

## Prototype limitations

Before any real-world deployment, this application would require
review and additional engineering, including:

- Verification of applicable legal and administrative requirements
- Stronger project-specific authorization and personal-data controls
- Database migrations and a documented first-run initialization process
- Production-ready server and secret-management configuration
- Security, accessibility, load, and recovery testing
- Backup, restoration, monitoring, and operational procedures
- Formal validation of GIS data, land records, valuation inputs,
  administrative decisions, and external integrations

Do not expose this local development configuration directly to the
public internet.

## Troubleshooting

Inspect service status:

    docker compose ps

Inspect recent backend logs:

    docker compose logs --tail=80 api

Check the API:

    http://127.0.0.1:8001/health

If the frontend is unavailable, confirm that its Vite terminal is still
running and that you opened the same hostname and port used to start it.

If login succeeds but records are missing on a fresh installation,
check whether the expected demonstration accounts and records were
initialized in that installation's database.