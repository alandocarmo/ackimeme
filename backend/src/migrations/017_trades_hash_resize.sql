-- Migration: 017_trades_hash_resize
-- Purpose: Aumentar tx_hash para VARCHAR(128) para suportar hashes compostos (tx_id + msg_id)

ALTER TABLE trades ALTER COLUMN tx_hash TYPE VARCHAR(128);
