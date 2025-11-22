-- Convert campaign_briefs to prose format (80-120 words with markdown)
-- This migration:
-- 1. Adds brief_content TEXT field for the prose brief
-- 2. Keeps product_name, product_category, cover_image_url
-- 3. Removes structured fields: product_description, audience, unique_benefit, main_message

-- Step 1: Add new prose field with temporary default
ALTER TABLE campaign_briefs
ADD COLUMN brief_content TEXT DEFAULT '';

-- Step 2: Migrate existing briefs to prose format (create placeholder content)
-- In production, you'd want to regenerate briefs instead
UPDATE campaign_briefs
SET brief_content =
  '**What Is It**' || E'\n' ||
  COALESCE(product_description, 'A ' || product_category || ' product') || E'\n\n' ||
  '**Who It''s For**' || E'\n' ||
  COALESCE(audience, 'Target audience') || E'\n\n' ||
  '**The Difference**' || E'\n' ||
  COALESCE(unique_benefit, 'Unique benefit') || E'\n\n' ||
  '**Main Message**' || E'\n' ||
  COALESCE(main_message, 'Main campaign message')
WHERE brief_content = '';

-- Step 3: Remove old structured fields
ALTER TABLE campaign_briefs
DROP COLUMN IF EXISTS product_description,
DROP COLUMN IF EXISTS audience,
DROP COLUMN IF EXISTS unique_benefit,
DROP COLUMN IF EXISTS main_message;

-- Step 4: Make brief_content required
ALTER TABLE campaign_briefs
ALTER COLUMN brief_content DROP DEFAULT,
ALTER COLUMN brief_content SET NOT NULL;

-- Add helpful comments for the new structure
COMMENT ON COLUMN campaign_briefs.product_name IS 'Product brand name (2-4 words)';
COMMENT ON COLUMN campaign_briefs.product_category IS 'Product category from game settings';
COMMENT ON COLUMN campaign_briefs.cover_image_url IS 'Optional AI-generated product image URL';
COMMENT ON COLUMN campaign_briefs.brief_content IS 'Prose campaign brief (80-120 words) with markdown bold subheadings';
