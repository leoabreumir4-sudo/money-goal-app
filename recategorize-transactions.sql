-- ========================================
-- Re-categorize Existing Transactions
-- ========================================
-- 
-- This script updates categoryId for ALL existing transactions
-- based on the optimized multilingual keywords in categories table.
--
-- INSTRUCTIONS:
-- 1. First, run setup-categories.sql to ensure categories have updated keywords
-- 2. Then run this script to re-categorize all transactions
-- 3. Verify results with the query at the bottom
--
-- HOW IT WORKS:
-- - Matches transaction.reason (description) against category keywords
-- - Uses LOWER() for case-insensitive matching
-- - Prioritizes categories with more keyword matches
-- - Falls back to "Other" category if no match found
--
-- ========================================

-- Create temporary function to find best matching category
CREATE OR REPLACE FUNCTION find_category_for_transaction(transaction_reason TEXT)
RETURNS INTEGER AS $$
DECLARE
  matched_category_id INTEGER;
  other_category_id INTEGER;
BEGIN
  -- Normalize transaction reason to lowercase
  transaction_reason := LOWER(transaction_reason);
  
  -- Find first category where any keyword matches
  SELECT c.id INTO matched_category_id
  FROM categories c
  WHERE c."isDefault" = true
    AND EXISTS (
      SELECT 1 
      FROM unnest(c.keywords) AS keyword
      WHERE transaction_reason LIKE '%' || LOWER(keyword) || '%'
    )
  ORDER BY 
    -- Prioritize categories with more keyword matches
    (
      SELECT COUNT(*)
      FROM unnest(c.keywords) AS keyword
      WHERE transaction_reason LIKE '%' || LOWER(keyword) || '%'
    ) DESC,
    c.id ASC
  LIMIT 1;
  
  -- If no match found, get "Other" category as fallback
  IF matched_category_id IS NULL THEN
    SELECT id INTO other_category_id
    FROM categories
    WHERE name = 'Other' AND "isDefault" = true
    LIMIT 1;
    
    RETURN other_category_id;
  END IF;
  
  RETURN matched_category_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Update transactions with NULL categoryId
-- ========================================
UPDATE transactions
SET "categoryId" = find_category_for_transaction(reason)
WHERE "categoryId" IS NULL;

-- ========================================
-- Re-categorize ALL transactions (optional)
-- ========================================
-- Uncomment the line below to re-categorize ALL transactions,
-- not just the ones with NULL categoryId:
--
-- UPDATE transactions
-- SET "categoryId" = find_category_for_transaction(reason);

-- ========================================
-- Clean up temporary function
-- ========================================
DROP FUNCTION IF EXISTS find_category_for_transaction(TEXT);

-- ========================================
-- Verification Queries
-- ========================================

-- Check transactions by category
SELECT 
  c.emoji,
  c.name,
  COUNT(t.id) as transaction_count,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) / 100.0 as total_expenses,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) / 100.0 as total_income
FROM categories c
LEFT JOIN transactions t ON t."categoryId" = c.id
WHERE c."isDefault" = true
GROUP BY c.id, c.emoji, c.name
ORDER BY transaction_count DESC;

-- Check for transactions still without category
SELECT COUNT(*) as uncategorized_count
FROM transactions
WHERE "categoryId" IS NULL;

-- Sample of re-categorized transactions
SELECT 
  t.id,
  t.reason,
  c.emoji,
  c.name as category,
  t.amount / 100.0 as amount,
  t.type
FROM transactions t
LEFT JOIN categories c ON t."categoryId" = c.id
ORDER BY t."createdDate" DESC
LIMIT 20;

-- ========================================
-- Expected Results
-- ========================================
-- After running this script, you should see:
-- - "iFood - Burger" → 🍽️ Restaurants
-- - "Artix Entertainment - Salary" → 💰 Salary
-- - "Freelance Design Work" → 💼 Freelance
-- - "Netflix - Assinatura mensal" → 📱 Subscriptions
-- - "Spotify Premium" → 📱 Subscriptions (or 🎵 Music)
-- - "ChatGPT Plus" → 📱 Subscriptions
-- - "Whey Protein" → 💊 Pharmacy
-- - "Creatina" → 💊 Pharmacy
-- - "Academia - Mensalidade" → 💪 Gym
-- - "Uber - Jantar" → 🚕 Uber/Taxi (or 🍽️ Restaurants)
-- ========================================
