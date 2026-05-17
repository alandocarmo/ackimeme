-- 020_used_tx_hashes_cleanup_idx.sql
-- Adiciona um índice na coluna used_at para acelerar processos de limpeza
-- cron ou rotinas que removerão hashes muito antigos da proteção anti-replay.

CREATE INDEX IF NOT EXISTS used_tx_hashes_used_at_idx ON used_tx_hashes (used_at);
