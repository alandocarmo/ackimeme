-- 009_shell_buy_orders.sql
-- Persist orders for in-app USDC -> SHELL purchase verification.

CREATE TABLE IF NOT EXISTS shell_buy_orders (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  usdc_amount NUMERIC(78, 18) NOT NULL CHECK (usdc_amount > 0),
  shell_amount NUMERIC(78, 18) NOT NULL CHECK (shell_amount > 0),
  usdc_recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_proof JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  on_chain_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shell_buy_orders_wallet_idx
  ON shell_buy_orders (wallet_address);

CREATE INDEX IF NOT EXISTS shell_buy_orders_status_idx
  ON shell_buy_orders (status);

CREATE INDEX IF NOT EXISTS shell_buy_orders_created_at_idx
  ON shell_buy_orders (created_at DESC);
