-- Alternative approach: Drop and recreate all tables with correct types
-- This is safe because all users were deleted

-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS "monthlyPayments" CASCADE;
DROP TABLE IF EXISTS "chatMessages" CASCADE;
DROP TABLE IF EXISTS "events" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "recurringExpenses" CASCADE;
DROP TABLE IF EXISTS "transactions" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "userSettings" CASCADE;
DROP TABLE IF EXISTS "goals" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop enums if they exist
DROP TYPE IF EXISTS "user_role" CASCADE;
DROP TYPE IF EXISTS "goal_status" CASCADE;
DROP TYPE IF EXISTS "transaction_type" CASCADE;
DROP TYPE IF EXISTS "theme" CASCADE;
DROP TYPE IF EXISTS "frequency" CASCADE;
DROP TYPE IF EXISTS "chat_role" CASCADE;

-- Now run the migration script on Render with MIGRATE=1
-- It will recreate everything with the correct schema
