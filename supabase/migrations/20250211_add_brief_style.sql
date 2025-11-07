-- Add brief_style column to game_rooms table
ALTER TABLE game_rooms
ADD COLUMN brief_style VARCHAR(20) DEFAULT 'wacky';

-- Add check constraint for brief_style
ALTER TABLE game_rooms
ADD CONSTRAINT brief_style_check CHECK (brief_style IN ('wacky', 'realistic'));

-- Add new fields to campaign_briefs table
ALTER TABLE campaign_briefs
ADD COLUMN tagline TEXT,
ADD COLUMN product_features TEXT,
ADD COLUMN weird_constraint TEXT;

-- Add comments for documentation
COMMENT ON COLUMN game_rooms.brief_style IS 'Style of brief generation: wacky or realistic';
COMMENT ON COLUMN campaign_briefs.tagline IS 'Product tagline (used in wacky briefs)';
COMMENT ON COLUMN campaign_briefs.product_features IS 'Key features or benefits of the product';
COMMENT ON COLUMN campaign_briefs.weird_constraint IS 'Absurd constraint or quirk (used in wacky briefs)';
