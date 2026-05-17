-- 021_uuid_defaults.sql
-- Define o valor default de gen_random_uuid() para as colunas ID das tabelas principais.
-- Isso previne que INSERTs falhem caso o backend omita o ID na query,
-- mas ainda permite que o backend injete um ID explícito quando necessário.

ALTER TABLE auth_challenges ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE wallet_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE launches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE treasury_payments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE risk_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE reward_tasks ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_events ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE launchpad_projects ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE launchpad_tasks ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE launchpad_task_submissions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE token_comments ALTER COLUMN id SET DEFAULT gen_random_uuid();
