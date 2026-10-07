# Blohsh Blast API

The API lives in `backend/` and is intentionally separated from the Vite frontend.

## Security

- Bearer JWT access tokens, 15 minutes.
- Passwords hashed with Node `scrypt`.
- Zod validation on every JSON mutation.
- Strict CORS allowlist.
- Per-IP and per-user rate limits.
- Server-issued game runs bind score submissions to the authenticated user.
- PostgreSQL parameterized queries plus DB constraints.
- Admin endpoints require `role=admin` from a verified JWT.

## Render deployment

`render.yaml` declares the API service and wires `DATABASE_URL` from the existing Render Postgres resource `blohsh-blast-db` using `fromDatabase`.

The current Render connector does not expose a Blueprint-sync action. Do not create the API as a standalone web service with a missing `DATABASE_URL`; the secure deployment path is to sync the repository Blueprint so the database secret is injected by Render.

Health endpoints:

- `/healthz` — process health.
- `/readyz` — readiness; requires database and JWT configuration.

## Important anti-cheat boundary

The current score envelope is server-side validation and ownership control, not a complete replay-verification system. A future authoritative version should submit a move sequence and let the server replay it against the server-issued seed and rules version.

## Database

Migrations are in `sql/001_init.sql` and are executed by `npm run migrate` before the API starts.
