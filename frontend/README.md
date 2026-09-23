# NLAM DSS frontend

See the [project setup guide](../README.md) for Windows checks, Docker, demo accounts, `npm.cmd ci`, and `npm.cmd run dev -- --host 127.0.0.1`.

The frontend expects the local FastAPI service at `http://127.0.0.1:8001`. For another approved environment, set `VITE_API_URL` at build time. No API key or password belongs in a `VITE_` variable; Vite embeds these values into client-side code.
