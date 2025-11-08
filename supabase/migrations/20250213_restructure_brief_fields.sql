-- Restructure campaign_briefs table to simplified brief format
-- This migration:
-- 1. Removes tagline and weird_constraint (old optional fields)
-- 2. Adds main_point (short communication objective)
-- 3. Adds strategy (how campaign achieves objective)
-- 4. Renames target_audience to audience
-- 5. Makes product_features required (was optional)

-- Step 1: Add new required fields with temporary defaults
ALTER TABLE campaign_briefs
ADD COLUMN main_point TEXT DEFAULT '',
ADD COLUMN strategy TEXT DEFAULT '';

-- Step 2: Rename target_audience to audience
ALTER TABLE campaign_briefs
RENAME COLUMN target_audience TO audience;

-- Step 3: Make product_features NOT NULL (it was optional, now required)
-- First set any NULL values to empty string
UPDATE campaign_briefs
SET product_features = ''
WHERE product_features IS NULL;

-- Then add NOT NULL constraint
ALTER TABLE campaign_briefs
ALTER COLUMN product_features SET NOT NULL;

-- Step 4: Remove old optional fields
ALTER TABLE campaign_briefs
DROP COLUMN IF EXISTS tagline,
DROP COLUMN IF EXISTS weird_constraint;

-- Step 5: Remove default constraints and make new fields required
ALTER TABLE campaign_briefs
ALTER COLUMN main_point DROP DEFAULT,
ALTER COLUMN main_point SET NOT NULL,
ALTER COLUMN strategy DROP DEFAULT,
ALTER COLUMN strategy SET NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN campaign_briefs.main_point IS 'Short phrase describing the singular key communication objective';
COMMENT ON COLUMN campaign_briefs.strategy IS 'How the creative campaign should achieve the objective';
COMMENT ON COLUMN campaign_briefs.audience IS '1-2 bullets about target demographic';
COMMENT ON COLUMN campaign_briefs.business_problem IS '1-3 bullets about the business challenge';
COMMENT ON COLUMN campaign_briefs.product_features IS '3 bullets describing key product features';
