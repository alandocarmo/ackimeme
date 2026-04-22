-- 010_deploy_status.sql
-- Audit #3: deployStatus e deployReason do launchTicket.onchainData
-- não eram persistidos no banco. Adiciona colunas dedicadas para
-- rastrear estados intermediários reais do deploy on-chain.

ALTER TABLE launches
  ADD COLUMN IF NOT EXISTS deploy_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deploy_reason TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS launches_deploy_status_idx ON launches (deploy_status);
