-- Verification SQL for migration 0003_add_categories_and_currency.sql

-- 1. Check if new columns were added to categories table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- 2. Check if new columns were added to transactions table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- 3. Check if default categories were inserted (should be 12)
SELECT 
  COUNT(*) as total_default_categories,
  COUNT(CASE WHEN "isDefault" = TRUE THEN 1 END) as default_count,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as null_user_count
FROM categories;

-- 4. List all default categories with their keywords count
SELECT 
  id,
  name,
  emoji,
  color,
  array_length(keywords, 1) as keywords_count,
  "isDefault"
FROM categories
WHERE "isDefault" = TRUE
ORDER BY id;

-- 5. Check if indexes were created
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE tablename IN ('categories', 'transactions')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 6. Sample keywords from each category
SELECT 
  name,
  keywords[1:5] as sample_keywords
FROM categories
WHERE "isDefault" = TRUE
ORDER BY name;

-- 7. Check transactions table structure (currency default should be 'USD')
SELECT 
  column_name,
  column_default
FROM information_schema.columns 
WHERE table_name = 'transactions' 
  AND column_name IN ('currency', 'exchangeRate', 'categoryId');
