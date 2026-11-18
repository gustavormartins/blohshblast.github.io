-- Compatibility layer for a Supabase-hosted PostgreSQL database.
-- The current BlohshBlast backend uses its own short-lived JWTs and accesses
-- PostgreSQL server-side; it does NOT use Supabase Auth's JWT claims.
-- Do not expose browser access to player records, password hashes or scores.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users, public.game_runs, public.scores
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.scores_id_seq
  FROM PUBLIC, anon, authenticated;

-- Minimize the risk of exposing future tables to the Data API by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- No public policies until the application integrates Supabase Auth.
-- Existing backend must connect with a confidential server-only Postgres role.
