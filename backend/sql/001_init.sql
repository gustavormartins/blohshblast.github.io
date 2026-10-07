CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role varchar(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_runs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode varchar(16) NOT NULL CHECK (mode IN ('classic', 'zen', 'hardcore', 'daily', 'campaign', 'dungeon')),
  seed bigint NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS scores (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE REFERENCES game_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode varchar(16) NOT NULL CHECK (mode IN ('classic', 'zen', 'hardcore', 'daily', 'campaign', 'dungeon')),
  score integer NOT NULL CHECK (score >= 0 AND score <= 5000000),
  moves integer NOT NULL CHECK (moves >= 1 AND moves <= 10000),
  lines integer NOT NULL CHECK (lines >= 0 AND lines <= 40000),
  combo integer NOT NULL CHECK (combo >= 0 AND combo <= 10000),
  perfect_clear boolean NOT NULL DEFAULT false,
  rules_version varchar(16) NOT NULL DEFAULT 'phase4',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_runs_user_started ON game_runs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_mode_score ON scores (mode, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_user_created ON scores (user_id, created_at DESC);
