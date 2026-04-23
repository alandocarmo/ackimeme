-- Migration: 013_launchpad_submission_index.sql
-- Description: Adiciona índice composto na tabela launchpad_task_submissions para otimizar queries do painel de admin (BUG-6)

CREATE INDEX IF NOT EXISTS launchpad_task_submissions_project_status_idx 
ON launchpad_task_submissions (project_id, status);
