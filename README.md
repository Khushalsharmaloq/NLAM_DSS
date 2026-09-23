# NLAM DSS — Run locally in VS Code (Windows)

National Land Acquisition & Management Decision Support System (NLAM DSS). This README documents the **three commands confirmed working on the current Windows setup**, plus first-time preparation, links, and troubleshooting. Run commands in the VS Code **PowerShell** terminal.

## Run the project — the three working commands

**Terminal 1 — from the project root (`NLAM_DSS`):**

```powershell
docker compose up -d --build
```

This builds/starts the FastAPI API and PostgreSQL/PostGIS database in Docker. Wait for Docker to finish and report the database healthy and the API running.

**Terminal 1 — still in the project root:**

```powershell
docker compose ps
```

Confirm that the `api` service is `Up` and the `db` service is `Up (healthy)`. The API is mapped to `127.0.0.1:8001` on your computer.

**Terminal 2 — open a new VS Code terminal, then go to `frontend/`:**

```powershell
cd .\frontend\
npm run dev -- --host 127.0.0.1
```

If your terminal is **already inside `frontend/`**, run only `npm run dev -- --host 127.0.0.1`. Leave this terminal open while using the website.

### Open the application

| What | Local URL |
| --- | --- |
| Website (frontend) | http://127.0.0.1:5173/ |
| API | http://127.0.0.1:8001/ |
| Interactive API docs | http://127.0.0.1:8001/docs |
| API/database health | http://127.0.0.1:8001/health |

**Note:** The three commands start the existing application; they do not automatically create login accounts. If demo accounts have already been created, use your existing credentials. If this is a fresh database, see the optional demo-account setup below.

## Optional: create demo accounts on a fresh database

Run **once** from the project root, after the containers have started:

```powershell
docker compose exec -e DEMO_ADMIN_PASSWORD="AdminDemo2026!" -e DEMO_USER_PASSWORD="UserDemo2026!" api python -m app.seed_demo
```

Demo usernames: `system.admin` (admin password above), `project.officer`, `district.authority`, and `state.authority` (user password above). These are **local demonstration credentials only**. The seed script skips accounts that already exist; it does not reset their passwords. Change example passwords for shared environments.

## Stop and restart

- Stop the frontend with **Ctrl+C** in its terminal.
- From the project root, stop the backend and database with `docker compose down`. This preserves named-volume database and document data.
- Next time, start Docker Desktop and repeat the **three working commands** above. `npm install` and demo-account creation are not normally needed again.
- **Do not run `docker compose down -v`** unless you intentionally want to delete the database and document volumes.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| `docker` not recognized / cannot connect to Docker daemon | Install/start Docker Desktop; wait for the engine, then reopen the VS Code terminal. Run `docker version`. |
| `no configuration file provided` | Run Docker commands from the project root, where `compose.yaml` is located. |
| `JWT_SECRET must be configured` / missing DB variables | Check the root `.env` file for `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `JWT_SECRET`. Save it, then rerun `docker compose up -d --build`. |
| Database is not healthy / API is restarting | Run `docker compose ps`, `docker compose logs --tail=100 db`, and `docker compose logs --tail=100 api`. Fix the reported error before retrying. |
| API URL does not open | Verify `api` is `Up` with `docker compose ps`; inspect `docker compose logs --tail=100 api`. Open http://127.0.0.1:8001/health. |
| Port `8001` or `5173` already in use | Stop the other program using that port, or stop an older instance of this project. Avoid starting a second frontend server. |
| `npm` not recognized | Install Node.js, restart VS Code, and verify `node -v` and `npm -v`. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd install` for first-time installation and `npm.cmd run dev -- --host 127.0.0.1` to start the frontend. |
| `vite` not recognized / missing package | From `frontend/`, run `npm install`, then rerun the frontend command. |
| Frontend opens but login or data requests fail | Confirm http://127.0.0.1:8001/health works. Check browser DevTools → Network for the failed request and inspect API logs. If using a fresh database, seed demo accounts once. |
| Demo username/password does not work | Check whether the accounts were seeded. Re-running the seed command **does not overwrite existing accounts or passwords**. Use the password originally set for that account. |
| Changed `.env` database password but login to database fails | Existing PostgreSQL named volumes retain the password initialized on the first run. Restore the original matching `.env` credentials or deliberately change the database user's password; do not delete volumes just to troubleshoot. |
| Changes to frontend do not appear | Keep Vite running, refresh the browser, and check the frontend terminal for compilation errors. |

### Useful diagnostics (run from project root)

```powershell
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 db
```

When asking for help, share the **error message and relevant log lines**, but remove passwords, tokens, and personal information first.

## Technology and current scope

- Frontend: React, TypeScript, Vite, Leaflet.
- Backend: Python, FastAPI.
- Database: PostgreSQL with PostGIS, run through Docker Compose.
- Current prototype modules include project proposals, review workflow, GIS parcels, compensation estimates, rehabilitation planning, possession progress, document handling, and MIS dashboards. Some national-scale, statutory, and external-integration requirements remain future work; running the application does not imply they are complete.
