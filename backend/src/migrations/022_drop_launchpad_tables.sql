-- 022_drop_launchpad_tables.sql
-- Remove tabelas do Launchpad antigo e reward_tasks que foram descontinuadas

DROP TABLE IF EXISTS launchpad_task_submissions CASCADE;
DROP TABLE IF EXISTS launchpad_tasks CASCADE;
DROP TABLE IF EXISTS launchpad_projects CASCADE;
DROP TABLE IF EXISTS reward_tasks CASCADE;
