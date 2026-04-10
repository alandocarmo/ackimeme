CREATE TABLE IF NOT EXISTS launchpad_projects (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT 'exclusive',
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL DEFAULT '',
  reward_label TEXT NOT NULL DEFAULT '',
  reward_token TEXT NOT NULL DEFAULT '',
  reward_amount NUMERIC(78, 18) NOT NULL DEFAULT 0,
  participant_limit INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  created_by TEXT NOT NULL DEFAULT 'admin',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS launchpad_projects_status_idx
  ON launchpad_projects (status);

CREATE INDEX IF NOT EXISTS launchpad_projects_sort_order_idx
  ON launchpad_projects (sort_order ASC, created_at DESC);

CREATE TABLE IF NOT EXISTS launchpad_tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES launchpad_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  task_type TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '',
  reward_points INTEGER NOT NULL DEFAULT 0,
  reward_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS launchpad_tasks_project_sort_idx
  ON launchpad_tasks (project_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS launchpad_tasks_status_idx
  ON launchpad_tasks (status);

CREATE TABLE IF NOT EXISTS launchpad_task_submissions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES launchpad_projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES launchpad_tasks(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  session_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  proof_text TEXT NOT NULL DEFAULT '',
  proof_url TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS launchpad_task_submissions_project_idx
  ON launchpad_task_submissions (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS launchpad_task_submissions_wallet_idx
  ON launchpad_task_submissions (wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS launchpad_task_submissions_status_idx
  ON launchpad_task_submissions (status);
