-- Update deprecated product categories
-- This migration handles the product category consolidation:
-- 1. Merge "Consumer Electronics" and "Technology & Software" into "Consumer Technology"
-- 2. Remove deprecated categories: Automotive, Real Estate, Education, Other
-- 3. Rooms with deprecated categories default to "All"

-- Update existing rooms with deprecated categories
UPDATE game_rooms
SET product_category = CASE
  -- Merge Consumer Electronics and Technology & Software
  WHEN product_category IN ('Consumer Electronics', 'Technology & Software') THEN 'Consumer Technology'

  -- Deprecated categories default to "All"
  WHEN product_category IN ('Automotive', 'Real Estate', 'Education', 'Other') THEN 'All'

  -- Keep all other categories as-is
  ELSE product_category
END
WHERE product_category IN (
  'Consumer Electronics',
  'Technology & Software',
  'Automotive',
  'Real Estate',
  'Education',
  'Other'
);

-- Update campaign briefs with deprecated categories
UPDATE campaign_briefs
SET product_category = CASE
  -- Merge Consumer Electronics and Technology & Software
  WHEN product_category IN ('Consumer Electronics', 'Technology & Software') THEN 'Consumer Technology'

  -- Deprecated categories default to "All"
  WHEN product_category IN ('Automotive', 'Real Estate', 'Education', 'Other') THEN 'All'

  -- Keep all other categories as-is
  ELSE product_category
END
WHERE product_category IN (
  'Consumer Electronics',
  'Technology & Software',
  'Automotive',
  'Real Estate',
  'Education',
  'Other'
);
