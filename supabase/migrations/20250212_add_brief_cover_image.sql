-- Add cover_image_url column to campaign_briefs table
ALTER TABLE campaign_briefs
ADD COLUMN cover_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN campaign_briefs.cover_image_url IS 'Base64 data URL of generated product cover image';
