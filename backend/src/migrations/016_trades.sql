-- Migration: 016_trades
-- Purpose: Armazenar histórico de transações (trades) na Bonding Curve

CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    tx_hash VARCHAR(64) NOT NULL UNIQUE,
    wallet_address VARCHAR(66) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
    token_amount NUMERIC NOT NULL,
    shell_amount NUMERIC NOT NULL,
    price NUMERIC NOT NULL, -- Preço unitário da transação (shell_amount / token_amount)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_launch_id_created_at ON trades(launch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_wallet_address ON trades(wallet_address);
