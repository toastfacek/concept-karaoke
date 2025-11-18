-- Simplify campaign_briefs to 6-field structure for faster reading (~30 seconds)
-- This migration:
-- 1. Removes verbose fields: business_problem, objective, strategy, product_features, main_point
-- 2. Adds concise fields: product_description, unique_benefit, main_message
-- 3. Keeps: product_name, product_category, cover_image_url, audience

-- Step 1: Add new simplified fields with temporary defaults
ALTER TABLE campaign_briefs
ADD COLUMN product_description TEXT DEFAULT '',
ADD COLUMN unique_benefit TEXT DEFAULT '',
ADD COLUMN main_message TEXT DEFAULT '';

-- Step 2: Remove verbose fields
ALTER TABLE campaign_briefs
DROP COLUMN IF EXISTS business_problem,
DROP COLUMN IF EXISTS objective,
DROP COLUMN IF EXISTS strategy,
DROP COLUMN IF EXISTS product_features,
DROP COLUMN IF EXISTS main_point;

-- Step 3: Remove default constraints and make new fields required
ALTER TABLE campaign_briefs
ALTER COLUMN product_description DROP DEFAULT,
ALTER COLUMN product_description SET NOT NULL,
ALTER COLUMN unique_benefit DROP DEFAULT,
ALTER COLUMN unique_benefit SET NOT NULL,
ALTER COLUMN main_message DROP DEFAULT,
ALTER COLUMN main_message SET NOT NULL;

-- Add helpful comments for the new brief structure
COMMENT ON COLUMN campaign_briefs.product_name IS 'Product brand name (2-4 words)';
COMMENT ON COLUMN campaign_briefs.product_category IS 'Product category from game settings';
COMMENT ON COLUMN campaign_briefs.cover_image_url IS 'AI-generated product image URL';
COMMENT ON COLUMN campaign_briefs.product_description IS 'One sentence product description (~10 words)';
COMMENT ON COLUMN campaign_briefs.audience IS 'Target audience label (~8 words)';
COMMENT ON COLUMN campaign_briefs.unique_benefit IS 'What makes product different (~12 words)';
COMMENT ON COLUMN campaign_briefs.main_message IS 'Singular ad message (~6 words)';

-- Add wacky_brief_style column to game_rooms for wacky mode sub-styles
ALTER TABLE game_rooms
ADD COLUMN wacky_brief_style VARCHAR(50) DEFAULT 'absurd_constraints';

COMMENT ON COLUMN game_rooms.wacky_brief_style IS 'Sub-style for wacky briefs: absurd_constraints, genre_mashups, unnecessary_solutions, conflicting_elements';
