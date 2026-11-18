# Supabase database cutover — BlohshBlast

## Status

- New Supabase project: `blohsh-blast` (Blohsh Corp, `sa-east-1`, ref `uphjuogymhflhakvpzdq`).
- Supabase PostgreSQL 17 database is healthy. Tables `public.users`, `public.game_runs`, and `public.scores` were created using the compatible original `backend/sql/001_init.sql` schema.
- Supabase migration history includes `blohsh_blast_initial_schema_private_api`.
- All three app tables have RLS enabled. `anon` and `authenticated` have no table privileges, and no public RLS policies have been added.
- **No historical data has been migrated.** All three tables contained zero rows when validated.
- Render Postgres `blohsh-blast-db` was suspended as of 2026-11-18. Preserve it; do not delete or replace it before confirming whether an export/recovery is possible.
- The Vercel static frontend is deployed, but the existing Node API is **not yet connected** to this Supabase database. `VITE_API_BASE_URL` is not a database connection string.

## Server-side connection requirements

1. Decide where to run the existing `backend/` Node API (Vercel Function, Supabase Edge Function adaptation, or separate Node host). The current `backend/src/server.mjs` binds a long-running HTTP server and cannot simply be treated as a Vercel Function without adaptation.
2. Configure **server-side only** `DATABASE_URL` using the project's appropriate SSL-enabled PostgreSQL connection/pooler URI; store it only in the backend host's secret manager. Never place database credentials in `VITE_*` variables, static assets or source control.
3. Configure a strong secret JWT key (`JWT_SECRET`, 32+ bytes), allowed frontend origin, and run the idempotent migrations.
4. Verify backend `/healthz`, `/readyz`, register/login, ownership checks, and leaderboard writes/reads on a test account. Confirm that the app is not using public Supabase Data API access for private game data.
5. Only then switch the frontend's API endpoint and test both desktop and mobile.

## Historical data preservation

If the old Render database can be revived, export it to a protected location before any import. Compare table counts and key constraints, and import inside a transaction with conflict reconciliation. Do not infer that an empty Supabase database means the Render database contained no data. Browser localStorage is per-origin and will **not** automatically move from Render to Vercel.

## Security rationale

The app currently issues its own JWTs, so Supabase Auth's `auth.uid()` is not usable as an ownership policy for its current tokens. Direct client access is intentionally blocked. Future adoption of Supabase Auth requires a separate identity-migration design and explicit row ownership policies.
