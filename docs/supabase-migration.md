# Supabase database cutover — BlohshBlast

## Status

- New Supabase project: `blohsh-blast` (Blohsh Corp, `sa-east-1`, ref `uphjuogymhflhakvpzdq`).
- Supabase PostgreSQL 17 database is healthy. Tables `public.users`, `public.game_runs`, and `public.scores` were created using the compatible original `backend/sql/001_init.sql` schema.
- Supabase migration history includes `blohsh_blast_initial_schema_private_api`.
- All three app tables have RLS enabled. `anon` and `authenticated` have no table privileges, and no public RLS policies have been added.
- **No historical data has been migrated.** All three tables contained zero rows when validated.
- User confirmed Render contained no data they need and authorized deletion of the BlohshBlast Render resources on 2026-11-18. **Deletion has not happened** because the available Render integration lacks delete actions; it must be completed in the Render Dashboard. Do not touch the unrelated `Blohsh_AI` service.
- The Vercel static frontend is deployed, but the existing Node API is **not yet connected** to this Supabase database. `VITE_API_BASE_URL` is not a database connection string.

## Server-side connection requirements

1. Decide where to run the existing `backend/` Node API (Vercel Function, Supabase Edge Function adaptation, or separate Node host). The current `backend/src/server.mjs` binds a long-running HTTP server and cannot simply be treated as a Vercel Function without adaptation. `MemoryRateLimiter` is process-local; before deploying to a serverless service replace it with a shared persistent rate limiter.
2. Configure **server-side only** `DATABASE_URL` using the project's **Transaction Pooler** URI (port `6543` for serverless); store it only in the backend host's secret manager. Never place database credentials in `VITE_*` variables, static assets or source control. Production Node `pg` now enforces verified TLS and uses a bounded pool. Obtain the exact hostname/username from Supabase's **Connect** panel, not guesses.
3. Configure a strong secret JWT key (`JWT_SECRET`, 32+ bytes), allowed frontend origin, and run the idempotent migrations.
4. Use `cd backend && npm run db:check` in the configured backend environment, then verify backend `/healthz`, `/readyz`, register/login, ownership checks, and leaderboard writes/reads on a test account. Confirm that the app is not using public Supabase Data API access for private game data.
5. Only then switch the frontend's API endpoint and test both desktop and mobile.

## Historical data preservation

The old Render database is suspended and the user says no migration of historical server data is needed. It has not been deleted automatically. Any browser localStorage is per-origin and will **not** automatically move from Render to Vercel, so players may still have local progress tied to the old origin.

## Security rationale

The app currently issues its own JWTs, so Supabase Auth's `auth.uid()` is not usable as an ownership policy for its current tokens. Direct client access is intentionally blocked. Future adoption of Supabase Auth requires a separate identity-migration design and explicit row ownership policies.
