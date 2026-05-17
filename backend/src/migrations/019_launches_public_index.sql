CREATE INDEX IF NOT EXISTS idx_launches_public_status ON launches (is_public, status, created_at DESC);
