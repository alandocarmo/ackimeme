-- Migration 008: Add last_comment_at to wallet_rate_limits
-- Audit N3: Moves comment rate limiting from in-memory Map to PostgreSQL
ALTER TABLE wallet_rate_limits ADD COLUMN IF NOT EXISTS last_comment_at TIMESTAMPTZ;
