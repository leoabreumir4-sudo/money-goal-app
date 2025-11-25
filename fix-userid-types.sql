-- Script to convert userId columns from integer to uuid
-- Run this directly in Neon SQL Editor

-- Step 1: Alter all userId columns to text/uuid type
ALTER TABLE "goals" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "categories" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "transactions" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "userSettings" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "recurringExpenses" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "projects" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "events" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "chatMessages" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;
ALTER TABLE "monthlyPayments" ALTER COLUMN "userId" TYPE uuid USING "userId"::text::uuid;

-- Step 2: Re-add foreign key constraints (if they existed)
-- Note: Since the database was just cleaned (all users deleted), 
-- there should be no data to worry about

-- Verify the changes
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE column_name = 'userId' 
ORDER BY table_name;
