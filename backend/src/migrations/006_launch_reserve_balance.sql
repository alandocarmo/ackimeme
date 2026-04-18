-- 006_launch_reserve_balance.sql
-- Adiciona campos para trackear o progresso da bonding curve
-- Usamos NUMERIC porque os valores em "nanos" de TVM podem ultrapassar o limite de BIGINT

ALTER TABLE launches
  ADD COLUMN IF NOT EXISTS reserve_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_supply NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_liquidity BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onchain_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS launches_reserve_idx ON launches (reserve_balance);
