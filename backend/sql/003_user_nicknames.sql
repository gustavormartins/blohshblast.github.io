-- Public display names are optional identity metadata; never expose account emails in leaderboards.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nickname varchar(16) NOT NULL DEFAULT 'PLAYER'
  CHECK (nickname ~ '^[A-Za-z0-9 _-]{1,16}$');
