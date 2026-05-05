-- Migration 015: Rate Limit Fix
-- Removes the default constraint and NOT NULL requirement from last_launch_at
-- This prevents the comment endpoint from unintentionally setting a last_launch_at timestamp
-- and locking the user out of creating a token for 1 hour just because they commented.

ALTER TABLE wallet_rate_limits ALTER COLUMN last_launch_at DROP DEFAULT;
ALTER TABLE wallet_rate_limits ALTER COLUMN last_launch_at DROP NOT NULL;
