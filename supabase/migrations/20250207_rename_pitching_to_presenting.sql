-- Migration: Rename "pitching" to "presenting" (Presentation Phase)
-- This renames the game phase where players present their completed campaigns

-- Rename game_rooms columns
ALTER TABLE game_rooms RENAME COLUMN current_pitch_index TO current_present_index;
ALTER TABLE game_rooms RENAME COLUMN pitch_sequence TO present_sequence;

-- Rename adlobs columns
ALTER TABLE adlobs RENAME COLUMN assigned_pitcher TO assigned_presenter;
ALTER TABLE adlobs RENAME COLUMN pitch_order TO present_order;
ALTER TABLE adlobs RENAME COLUMN pitch_started_at TO present_started_at;
ALTER TABLE adlobs RENAME COLUMN pitch_completed_at TO present_completed_at;

-- Update status enum constraint to include 'presenting' and remove 'pitching'
-- First, we need to add the new value
ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_status_check;
ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_status_check
  CHECK (status IN ('lobby', 'briefing', 'creating', 'presenting', 'pitching', 'voting', 'results'));

-- Update any existing records
UPDATE game_rooms SET status = 'presenting' WHERE status = 'pitching';

-- Remove the old value from the constraint
ALTER TABLE game_rooms DROP CONSTRAINT game_rooms_status_check;
ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_status_check
  CHECK (status IN ('lobby', 'briefing', 'creating', 'presenting', 'voting', 'results'));
