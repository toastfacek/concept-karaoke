-- Pitch flow metadata additions

ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS current_pitch_index INTEGER,
ADD COLUMN IF NOT EXISTS pitch_sequence UUID[];

ALTER TABLE adlobs
ADD COLUMN IF NOT EXISTS pitch_order INTEGER,
ADD COLUMN IF NOT EXISTS pitch_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pitch_completed_at TIMESTAMP WITH TIME ZONE;
