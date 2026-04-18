-- 007_treasury_tx_hash_unique.sql
-- Item #13: Adiciona restrição UNIQUE em treasury_payments.tx_hash para evitar reuso de pagamento.
-- Item #18: Adiciona índice composto em wallet_sessions para acelerar limpeza.

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'treasury_payments_tx_hash_unique'
  ) THEN
    ALTER TABLE treasury_payments ADD CONSTRAINT treasury_payments_tx_hash_unique UNIQUE (tx_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wallet_sessions_token_expires_idx ON wallet_sessions (token, expires_at);
