# National Land Acquisition & Management System (NLAM DSS)

An integrated **local demonstration application** for problem statement **26016** (Department of Land Resources, Ministry of Rural Development). It combines proposal review, GIS parcels, notifications and awards, a compensation ledger, R&R tracking, milestones, documents, scoped dashboards and reports.

> **Use synthetic data.** The application does not publish statutory notices, make bank transfers, certify possession, authenticate against government identity systems, or establish GIGW/STQC compliance. The supplied Google Drive folder was inaccessible from this build environment; no official dataset or state connector has been imported. Those capabilities require data owner approval, API contracts, security testing, governance decisions and production deployment.

## Technology by component

| Component | Included technology |
| --- | --- |
| Web interface | React 19, TypeScript, Vite 8, responsive CSS, React Router |
| Maps and coordinates | Leaflet, GeoJSON Polygon in WGS84 (EPSG:4326); OpenStreetMap tiles for local demonstration |
| REST API and validation | Python 3.12 in Docker, FastAPI, Pydantic |
| Data and spatial queries | PostgreSQL 17, PostGIS 3.5, SQLAlchemy and GeoAlchemy2 |
| Authentication and access | Argon2 password hashes, signed expiring JWT, server-side role and state/district/project checks |
| Documents | Private Docker volume, content signature checks, 10 MB limit, version lineage, authenticated downloads |
| Reporting and integration | Scoped live SQL summaries, CSV, explainable forecast, configurable HTTPS read-only land-record adapter |
| Local orchestration | Docker Compose (API and database) plus Node.js (Vite frontend) |

## Requirements covered

| Problem statement area | Working module |
| --- | --- |
| Proposal submission, scrutiny, approval and history | Project register and draft/returned editing; officer submission → district review/return → state decision; immutable workflow events |
| Parcels, geo-tagging and cadastral visualization | Polygon drawing, mobile location centering, PostGIS validity/area calculation, parcel GeoJSON, map preview of an external candidate boundary |
| Notifications and awards | Recorded notification–parcel links, award-to-notification/parcel checks, references and dates |
| Compensation assessed and paid | Award ledger plus payment entries with duplicate reference protection and award-balance cap; separate planning estimates |
| Possession and R&R | Parcel stage events, affected household planning, physical/economic impact and staged R&R progress |
| Timeline monitoring and alerts | Target dates, completion records, due/overdue work queue and 30-second refresh (when the page is open) |
| Dashboards and MIS | Overview, state totals, filtered national/jurisdiction dashboard, CSV export, explainable parcel-pace forecast |
| Stakeholders and security | National, state, district, project officer and administrator roles; per-project authorization on API routes; active/inactive users |
| Documents | File type and signature validation, download authorization, version chain and audit timeline |
| Government interoperability | HTTPS adapter ready for an approved state land-record API; unconfigured status is visible in the interface |

**Data definitions:** proposed area is a project proposal total; notified area sums distinct parcels linked to recorded notifications; acquired area here means area whose possession milestone has been recorded in this demonstration; assessed compensation is the sum of entered awards; paid compensation is the sum of recorded payment entries. A ledger entry is **not** proof of a bank transfer. The forecast extrapolates observed possession milestones and is not a trained ML model or legal estimate.

## Check your Windows PC first — no installation yet

1. Extract this ZIP into your `SIH_projet` folder and open the extracted **`NLAM_DSS`** folder in VS Code. Your PowerShell prompt should now end in `\SIH_projet\NLAM_DSS>`.
2. Run the following **read-only** check from the project root:

```powershell
Get-Location
Test-Path .\compose.yaml
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-system.ps1
```

Share the complete check output before installing anything. The script reports Windows, RAM, free disk, Node/npm, Docker/Compose/engine, WSL and port conflicts. It does not install software or display secrets. **Node.js 20.19+ or 22.12+** is needed for this version of Vite; Docker Desktop with WSL 2 is the intended Windows database/API runtime. Python and PostgreSQL do not need separate Windows installations for the Docker route.

## First setup (after the PC check)

Run all commands in VS Code **PowerShell**. Use the project root unless a command says `frontend`. Start Docker Desktop and wait for its engine to show Running before `docker compose` commands.

### 1. Create local secrets

The following PowerShell block creates `.env` with generated local passwords. Do this once. Do not post the `.env` file, which is excluded from the ZIP and Git.

```powershell
Copy-Item .\.env.example .\.env
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$dbBytes = New-Object byte[] 24
$jwtBytes = New-Object byte[] 48
$rng.GetBytes($dbBytes)
$rng.GetBytes($jwtBytes)
$dbSecret = -join ($dbBytes | ForEach-Object { $_.ToString('x2') })
$jwtSecret = -join ($jwtBytes | ForEach-Object { $_.ToString('x2') })
$envContent = Get-Content .\.env -Raw
$envContent = $envContent.Replace('replace_with_a_secure_password', $dbSecret)
$envContent = $envContent.Replace('replace_with_a_long_random_string_generated_in_powershell', $jwtSecret)
Set-Content .\.env $envContent -Encoding ascii
Remove-Variable dbSecret,jwtSecret,dbBytes,jwtBytes,envContent,rng
```

This project uses the isolated Docker project name `nlam-dss-26016`, so an older `nlam-dss-fresh` database is **not** modified when you run these commands. If you want to migrate old data, preserve its original `.env` and volumes and tell us before starting; plan a backup and a separate migration. Never generate a new password against an old database volume.

### 2. Start database and API (terminal 1, root)

```powershell
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://127.0.0.1:8001/health
```

Expected: `db` healthy, `api` running, health response reports `database: connected`. The backend creates PostGIS and any missing tables; an additive startup migration supports earlier prototype schemas **when deliberately pointed at them**. PostgreSQL and uploaded documents live in named Docker volumes.

### 3. Seed synthetic login accounts once (terminal 1, root)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\seed-demo.ps1
```

Choose **two different** passwords of at least 12 characters, including letters and numbers, when prompted. Re-running the seed skips existing users and never resets their passwords.

| Username | Role | Demonstration jurisdiction |
| --- | --- | --- |
| `system.admin` | System administrator | National |
| `central.ministry` | Central ministry viewer | National |
| `state.authority` | State authority | Uttar Pradesh |
| `district.authority` | District authority | Uttar Pradesh / Lucknow |
| `project.officer` | Project officer | Uttar Pradesh / Lucknow |

The first uses your admin password; the others use your user password. Log in as `project.officer` to create a proposal in **Uttar Pradesh / Lucknow**. Use the other roles in order to review and approve it. `system.admin` can create additional scoped accounts on the Administration page.

### 4. Start the web interface (terminal 2, root)

```powershell
cd .\frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open **http://127.0.0.1:5173/**. API documentation: **http://127.0.0.1:8001/docs**. `npm.cmd ci` installs the exact locked frontend dependencies; run it only once or when `package-lock.json` changes. `npm.cmd` avoids PowerShell's `npm.ps1` execution-policy issue.

### 5. Verify a full demonstration workflow

1. As `project.officer`, register a project; edit it if needed, draw a parcel on its GIS page, attach a PDF/image and add an affected-household planning record.
2. Submit the project under Workflow. As `district.authority`, start review. As `state.authority`, approve it.
3. As district/state authority, record a notification linked to the parcel, an award linked to that notification, and a reported disbursement against the award. Advancing parcel possession requires its earlier survey and documentation events.
4. Create and complete timeline milestones. Check Alerts, Reports, CSV, GIS and the audit history.

## Stop, restart and diagnose

In terminal 2 press **Ctrl+C**. In terminal 1:

```powershell
docker compose down
```

This keeps your data volumes. To restart, use `docker compose up -d --build` from the root and `npm.cmd run dev -- --host 127.0.0.1` from `frontend`. **Do not run `docker compose down -v`** unless you intentionally want to remove both the database and documents.

```powershell
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 db
```

| Problem | Check |
| --- | --- |
| Docker command missing / daemon unavailable | Start/install Docker Desktop, WSL 2 and virtualization after reviewing the PC check. |
| `JWT_SECRET must be configured` or DB errors | Confirm `.env` exists in the project root. Never change a password already in use by a Docker volume. |
| API does not start | Run the `logs` commands above. Migration requires the API database account to own the prototype schema. |
| Frontend cannot sign in | Check `/health`, seed accounts once, and use the password selected during the seed. |
| `npm` missing or Vite version failure | Check Node version. `npm.cmd ci` must finish in the `frontend` folder. |
| Map background does not load | OpenStreetMap tiles need browser internet access; stored polygons and PostGIS are separate. |
| `8001` or `5173` in use | Stop a previous copy of the app before starting another. |

To run checks in a development machine with Docker and Node:

```powershell
docker compose exec api python -m compileall -q app
docker compose run --rm --no-deps -v "${PWD}/backend/tests:/app/tests:ro" api sh -c "pip install -q pytest httpx && python -m pytest /app/tests -q"
cd .\frontend
npm.cmd run build
npm.cmd run lint
```

Unit/API authorization tests use an isolated SQLite database for users/projects; the PostGIS geometry and Docker startup path must also be exercised on a PC with Docker. Use **synthetic** test records only.

## External land-record and cadastral service

No universal state land-record API URL, token, schema or legal authorization was supplied. The adapter is intentionally **unconfigured** by default and shows that state clearly. If you have an approved read-only HTTPS endpoint, edit the root `.env`:

```dotenv
LAND_RECORDS_API_URL=https://approved-api.example.gov.in/v1/parcel-lookup
LAND_RECORDS_API_TOKEN=your_approved_service_token
```

Then run `docker compose up -d --force-recreate api`. The GET adapter sends the selected project's `state` and `district` with entered `village` and `survey_number`. Expected JSON keys are `survey_number`, `village`, `land_type`, `area_ha`, `record_reference` and optionally a GeoJSON `geometry` polygon. It never auto-saves external records: an officer can preview a simple polygon on the GIS map and verify it before submission. Integrations differ by state; adapt and test the connector with the actual provider's documentation. Keep real tokens out of Git and screenshots.

## Scope, audit and production path

API checks apply to all project routes, not merely the navigation: officers see owned projects in their assigned state, district authorities see their district, state authorities see their state, national viewers/admins see the nation. State/district spelling is an exact match after project creation. The administrator can assign scopes and deactivate accounts. **Legacy prototype projects** are assigned to `project.officer` during the additive migration, and earlier unscoped local users get the example Uttar Pradesh/Lucknow scope; check those assignments before continuing on a pre-existing database.

File uploads record uploader, date, type, and version lineage. The project audit view combines workflow, parcels, estimates, notifications, awards, payment entries, R&R changes, documents and milestones. It is an application-level record, not an independently sealed statutory audit log.

Before use with real landowner, household, or bank data: obtain DoLR and state integration contracts, validate legal workflows/fields with authorities, implement organization SSO/MFA, encrypt and protect backups, add malware scanning and retention/deletion policy, perform security and accessibility review, configure approved map tiles and hosting, and obtain any required GIGW/STQC certification. Official references: [DoLR DILRMP](https://dolr.gov.in/en/programmes-schemes/dilrmp-2/) and [Guidelines for Indian Government Websites](https://guidelines.india.gov.in/).

## Repository layout

```text
NLAM_DSS/
  backend/app/       FastAPI models, access guards, routers and demo seeding
  backend/migrations/ Additive SQL for existing local databases
  backend/tests/     Acquisition schema and authorization regression tests
  frontend/src/      React routes, components, styles and API client
  scripts/           Read-only Windows PC check and demo-account setup
  compose.yaml       PostgreSQL/PostGIS and API services
  .env.example       Safe variable names and placeholders
```
