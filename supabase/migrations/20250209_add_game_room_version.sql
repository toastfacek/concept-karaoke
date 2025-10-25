-- Add optimistic concurrency versioning to game_rooms

ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN game_rooms.version IS 'Monotonic version used for realtime snapshots and cache busting';
