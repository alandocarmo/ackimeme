-- 004_onchain_metadata.sql
-- Adiciona campos para rastreabilidade descentralizada dos tokens.

ALTER TABLE launches
  ADD COLUMN IF NOT EXISTS ipfs_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_root_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bonding_curve_address TEXT UNIQUE;

-- Indexamos os endereços para buscas rápidas on-chain -> off-chain
CREATE INDEX IF NOT EXISTS launches_token_root_idx ON launches (token_root_address);
CREATE INDEX IF NOT EXISTS launches_bonding_curve_idx ON launches (bonding_curve_address);
