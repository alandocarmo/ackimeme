-- Migration: 018_trades_hash_resize2
-- Purpose: Aumentar tx_hash para VARCHAR(256) para suportar hashes compostos (tx_id + msg_id)

ALTER TABLE trades ALTER COLUMN tx_hash TYPE VARCHAR(256);
