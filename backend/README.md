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

## Supabase PostgreSQL and Node.js connection

The static game runs at https://blohsh-blast.vercel.app. Supabase project `uphjuogymhflhakvpzdq` is hosted in São Paulo and contains the game schema. PostgreSQL is a **database**, not an automatically running Node server. The Node API still needs to be deployed separately.

For a temporary/serverless API host, get the **Transaction Pooler** URI from the Supabase Dashboard **Connect** panel (IPv4-compatible, port 6543). Store it as `DATABASE_URL` **only in the backend environment**, never in `VITE_*` or frontend code. Configure `JWT_SECRET` (at least 32 bytes), `NODE_ENV=production`, and `FRONTEND_ORIGIN=https://blohsh-blast.vercel.app`. If required, set `PG_SSL_CA` to the trusted CA PEM in the server-side secret manager.

The `pg` driver now enforces verified TLS/hostname verification in production and limits each serverless instance to two connections. The Supabase transaction pooler does not support prepared statements, but this backend uses unnamed parameterized queries.

Run `npm run db:check` from `backend/` **after** providing a valid server-side connection string. This performs a read-only query checking that the three game tables exist; it does not create accounts or scores and does not print credentials. Run `npm run migrate` only with an authorized deployment connection.

`/healthz` checks process health; `/readyz` requires the database and JWT settings. Do not point the browser to a new API until its readiness and login/score flows are tested.

The legacy Render database and static site can be manually removed in Render's Dashboard once no longer needed; Render's current connector cannot delete services.

## Important anti-cheat boundary

The current score envelope is server-side validation and ownership control, not a complete replay-verification system. A future authoritative version should submit a move sequence and let the server replay it against the server-issued seed and rules version.

## Database

Migrations are in `sql/001_init.sql` and are executed by `npm run migrate` before the API starts.

## Vercel deployment (Supabase integration)

The Vercel-Supabase marketplace integration automatically provisions a server-only
`POSTGRES_URL` in the Production environment. The Node API uses
`DATABASE_URL || POSTGRES_URL`; do not duplicate or expose the connection URL.

The Vercel project must also have a **separate, random** `JWT_SECRET` (at least
32 bytes), stored as a sensitive server-side production environment variable.
Do **not** use Supabase's JWT signing key as the game's JWT secret.

The root `api/index.mjs` is one Vercel Node.js Function, with same-origin
rewrites for `/healthz`, `/readyz` and `/api/v1/*`. The Vite frontend remains
static and unchanged. Root `package.json` contains the API runtime dependencies.
Production rate limiting uses the `api_rate_limits` PostgreSQL table with atomic
upserts, rather than ephemeral in-memory counters; it is restricted with RLS and
revoked client grants. Ensure `002_rate_limits.sql` is applied before production.

Validation: the preview environment may return 503 from `/readyz` because the
Supabase integration is Production-only. Validate the production endpoint after
its deployment and configuration. Run backend tests with `npm run test:backend`.
