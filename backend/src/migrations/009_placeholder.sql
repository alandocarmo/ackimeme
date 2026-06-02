-- BUG-04: Migration 009 foi pulada acidentalmente no passado.
-- Este placeholder previne problemas de sequenciamento no runner de migrações.
SELECT 1;
