CREATE INDEX IF NOT EXISTS idx_launches_onchain_updated_at 
ON launches (onchain_updated_at ASC NULLS FIRST)
WHERE status IN ('on_chain_deployed', 'on_chain_pending_recovery', 'deployment_queued');
