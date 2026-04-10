ALTER TABLE launchpad_task_submissions
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;

ALTER TABLE launchpad_task_submissions
ADD COLUMN IF NOT EXISTS reviewed_by TEXT NOT NULL DEFAULT '';

ALTER TABLE launchpad_task_submissions
ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';
