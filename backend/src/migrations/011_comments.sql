-- 011_comments.sql
CREATE TABLE IF NOT EXISTS token_comments (
    id UUID PRIMARY KEY,
    launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_comments_launch_id ON token_comments(launch_id);
CREATE INDEX IF NOT EXISTS idx_token_comments_created_at ON token_comments(created_at DESC);
