-- 005_persistent_rate_limit.sql
-- Persiste txHash usados e rate limit por wallet no PostgreSQL
-- para sobreviver a restarts do servidor.

CREATE TABLE IF NOT EXISTS used_tx_hashes (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS used_tx_hashes_wallet_idx ON used_tx_hashes (wallet_address);

CREATE TABLE IF NOT EXISTS wallet_rate_limits (
  wallet_address TEXT PRIMARY KEY,
  last_launch_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
