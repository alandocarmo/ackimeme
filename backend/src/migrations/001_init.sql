CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY,
  nonce TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  telegram_binding JSONB NOT NULL DEFAULT '{}'::jsonb,
  message TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_challenges_wallet_address_idx
  ON auth_challenges (wallet_address);

CREATE INDEX IF NOT EXISTS auth_challenges_expires_at_idx
  ON auth_challenges (expires_at);

CREATE TABLE IF NOT EXISTS wallet_sessions (
  id UUID PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  public_key TEXT NOT NULL,
  proof_level TEXT NOT NULL,
  telegram_binding JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_sessions_wallet_address_idx
  ON wallet_sessions (wallet_address);

CREATE INDEX IF NOT EXISTS wallet_sessions_expires_at_idx
  ON wallet_sessions (expires_at);

CREATE TABLE IF NOT EXISTS launches (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  minting_available BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  curated_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  launch_request JSONB NOT NULL,
  treasury_payment JSONB NOT NULL,
  risk_profile JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS launches_wallet_address_idx
  ON launches (wallet_address);

CREATE INDEX IF NOT EXISTS launches_created_at_idx
  ON launches (created_at DESC);

CREATE TABLE IF NOT EXISTS treasury_payments (
  id UUID PRIMARY KEY,
  launch_id UUID REFERENCES launches(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  amount NUMERIC(78, 18) NOT NULL,
  fee_wallet TEXT NOT NULL,
  app_fee_share_percent INTEGER NOT NULL,
  network_settlement_token TEXT NOT NULL,
  network_settlement_status TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS treasury_payments_creator_wallet_idx
  ON treasury_payments (creator_wallet);

CREATE INDEX IF NOT EXISTS treasury_payments_token_symbol_idx
  ON treasury_payments (token_symbol);

CREATE TABLE IF NOT EXISTS risk_profiles (
  id UUID PRIMARY KEY,
  launch_id UUID REFERENCES launches(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS risk_profiles_status_idx
  ON risk_profiles (status);

CREATE TABLE IF NOT EXISTS reward_tasks (
  id UUID PRIMARY KEY,
  launch_id UUID REFERENCES launches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '',
  reward_points INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_tasks_launch_id_idx
  ON reward_tasks (launch_id, sort_order);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  wallet_address TEXT NULL,
  launch_id UUID NULL,
  challenge_id UUID NULL,
  session_id UUID NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_events_type_idx
  ON audit_events (type);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
  ON audit_events (created_at DESC);
