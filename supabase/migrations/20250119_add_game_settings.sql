-- Add game settings columns to game_rooms table
ALTER TABLE game_rooms
ADD COLUMN product_category VARCHAR(100) DEFAULT 'Consumer Electronics',
ADD COLUMN phase_duration_seconds INTEGER DEFAULT 60;

-- Add check constraint for phase duration
ALTER TABLE game_rooms
ADD CONSTRAINT phase_duration_check CHECK (phase_duration_seconds IN (30, 60, 90, 120));

-- Add comment for documentation
COMMENT ON COLUMN game_rooms.product_category IS 'Product category for the campaign brief';
COMMENT ON COLUMN game_rooms.phase_duration_seconds IS 'Duration in seconds for each creation phase (30s, 60s, 90s, or 2m)';
