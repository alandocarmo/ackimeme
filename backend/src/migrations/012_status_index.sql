-- Migration: 012_status_index.sql
-- Description: Adiciona índice na coluna status da tabela launches para otimizar queries de feed e sync (BUG-9)

CREATE INDEX IF NOT EXISTS launches_status_idx ON launches (status);
