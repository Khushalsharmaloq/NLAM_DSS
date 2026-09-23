# NLAM DSS — Demonstration Operator Guide

## Scope

NLAM DSS is a local functional prototype using synthetic demonstration data.
It is not a production land-administration system.

Compensation and R&R amounts are indicative planning values, not approved
awards, verified entitlements, or payments. Parcel possession milestones
are demonstration progress records, not legal possession certificates.

## Starting the system

Open PowerShell in the NLAM_DSS project directory.

Start the backend services:

    docker compose up -d

Start the frontend in a separate terminal:

    Set-Location .\frontend
    npm.cmd run dev -- --host 127.0.0.1

Open the frontend:

    http://127.0.0.1:5173/

Run the pre-demo check in another PowerShell terminal from the project root:

    .\scripts\check-demo.ps1

Do not run `docker compose down -v`: that command removes the project's
named database and document volumes.

## Demonstration sequence

1. Sign in as the Project Officer and open the live MIS dashboard.
2. Open Project 3 and show its project details and GIS map.
3. Use the section navigation to show workflow history and documents.
4. Show the compensation register. Explain that the MIS planning total
   uses the latest saved estimate per parcel, not the sum of its history.
5. Show the synthetic R&R household register and parcel-progress history.
6. Sign out and sign in as the District Authority.
7. Show the read-only planning registers and role-specific progress controls.
   Do not change a project status or record possession simply for the demo.
8. Return to the dashboard, refresh, and confirm that saved records remain.

Use the existing local demonstration accounts. Do not place passwords in
this guide, presentation slides, screenshots, or the public repository.

## Troubleshooting

If the frontend cannot load the API:

    docker compose ps
    docker compose logs --tail=80 api

If Docker services are stopped:

    docker compose up -d

If the frontend is stopped, restart it in its own terminal using the command
above. Keep that terminal open during the demonstration.

The pre-demo check is read-only with respect to application records. It
checks availability and build health; it does not replace the full
integration and role-permission tests.