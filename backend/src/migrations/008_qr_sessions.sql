-- 008_qr_sessions.sql
-- Tabela para autenticação via QR Code / Deep Link.
-- Substitui o Map em memória (falha em serverless/multi-instância).

CREATE TABLE IF NOT EXISTS qr_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done | expired
  deep_link TEXT NOT NULL,
  session_token TEXT NULL,                  -- preenchido quando status = done
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS qr_sessions_expires_idx
  ON qr_sessions (expires_at);

CREATE INDEX IF NOT EXISTS qr_sessions_status_idx
  ON qr_sessions (status)
  WHERE status = 'pending';  -- partial index, só para pending
