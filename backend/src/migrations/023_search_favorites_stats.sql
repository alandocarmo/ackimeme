-- MELHORIA-01: Trigram index for text search on token name/symbol
-- Requires pg_trgm extension (available on most managed Postgres)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_launches_search_name
  ON launches USING gin (
    (COALESCE(launch_request->'coin'->>'name', '') || ' ' || COALESCE(launch_request->'coin'->>'symbol', ''))
    gin_trgm_ops
  );

-- MELHORIA-04: User favorites / watchlist
CREATE TABLE IF NOT EXISTS user_favorites (
  wallet_address TEXT NOT NULL,
  launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, launch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_wallet
  ON user_favorites (wallet_address, created_at DESC);

-- MELHORIA-02: Materialized stats (lightweight, computed on read)
-- No materialized view needed — we use a simple aggregate query.
