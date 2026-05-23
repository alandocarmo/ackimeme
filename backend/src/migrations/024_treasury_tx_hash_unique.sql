-- 024_treasury_tx_hash_unique.sql
-- Idempotent UNIQUE on treasury_payments.tx_hash (007 may already have added one).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'treasury_payments'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(tx_hash)%'
  ) THEN
    ALTER TABLE treasury_payments
      ADD CONSTRAINT treasury_payments_tx_hash_key UNIQUE (tx_hash);
  END IF;
END $$;
