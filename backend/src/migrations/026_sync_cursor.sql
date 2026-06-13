-- Migration: 026_sync_cursor
-- Purpose: Adiciona a coluna sync_cursor para persistência do estado de sincronização de trades

ALTER TABLE launches ADD COLUMN IF NOT EXISTS sync_cursor VARCHAR(255);
