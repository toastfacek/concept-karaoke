-- Migration: Rename "mantra" to "pitch" (Creation Phase Round 4)
-- This renames the final creation phase where players write the pitch for their campaign

-- Rename adlobs columns
ALTER TABLE adlobs RENAME COLUMN mantra_text TO pitch_text;
ALTER TABLE adlobs RENAME COLUMN mantra_created_by TO pitch_created_by;

-- Update current_phase enum constraint to include 'pitch' and remove 'mantra'
-- First, we need to add the new value
ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_current_phase_check;
ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_current_phase_check
  CHECK (current_phase IN ('big_idea', 'visual', 'headline', 'pitch', 'mantra'));

-- Update any existing records
UPDATE game_rooms SET current_phase = 'pitch' WHERE current_phase = 'mantra';

-- Remove the old value from the constraint
ALTER TABLE game_rooms DROP CONSTRAINT game_rooms_current_phase_check;
ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_current_phase_check
  CHECK (current_phase IN ('big_idea', 'visual', 'headline', 'pitch'));
