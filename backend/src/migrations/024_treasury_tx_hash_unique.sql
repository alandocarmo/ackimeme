ALTER TABLE treasury_payments ADD CONSTRAINT treasury_payments_tx_hash_key UNIQUE (tx_hash);
