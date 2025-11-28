-- ============================================================================
-- COMPLETE DATABASE SETUP - Money Goal App
-- Execute este arquivo COMPLETO no Neon SQL Editor
-- ============================================================================

-- Drop all existing enums if they exist (to avoid conflicts)
DROP TYPE IF EXISTS "user_role" CASCADE;
DROP TYPE IF EXISTS "goal_status" CASCADE;
DROP TYPE IF EXISTS "goal_type" CASCADE;
DROP TYPE IF EXISTS "transaction_type" CASCADE;
DROP TYPE IF EXISTS "theme" CASCADE;
DROP TYPE IF EXISTS "frequency" CASCADE;
DROP TYPE IF EXISTS "chat_role" CASCADE;
DROP TYPE IF EXISTS "budget_period" CASCADE;
DROP TYPE IF EXISTS "bill_status" CASCADE;
DROP TYPE IF EXISTS "insight_type" CASCADE;

-- Create all enums
CREATE TYPE "user_role" AS ENUM('user', 'admin');
CREATE TYPE "goal_status" AS ENUM('active', 'archived');
CREATE TYPE "goal_type" AS ENUM('savings', 'emergency', 'general');
CREATE TYPE "transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "theme" AS ENUM('dark', 'light');
CREATE TYPE "frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
CREATE TYPE "chat_role" AS ENUM('user', 'assistant', 'system');
CREATE TYPE "budget_period" AS ENUM('weekly', 'monthly', 'yearly');
CREATE TYPE "bill_status" AS ENUM('pending', 'paid', 'overdue');
CREATE TYPE "insight_type" AS ENUM('forecast', 'alert', 'suggestion', 'achievement');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"openId" varchar(64) NOT NULL UNIQUE,
	"passwordHash" text,
	"name" text,
	"email" varchar(320),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"phone_number" varchar(20),
	"phone_verified" boolean DEFAULT false
);

-- Goals table
CREATE TABLE IF NOT EXISTS "goals" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"goalType" "goal_type" DEFAULT 'savings' NOT NULL,
	"targetAmount" integer NOT NULL,
	"currentAmount" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"monthlyContribution" integer,
	"targetDate" timestamp,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"archivedDate" timestamp,
	"completedDate" timestamp
);

-- Categories table
CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY,
	"userId" uuid,
	"name" varchar(255) NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"color" varchar(7) NOT NULL,
	"keywords" text[],
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Transactions table
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"goalId" integer NOT NULL,
	"categoryId" integer,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(255) NOT NULL,
	"source" varchar(50),
	"currency" varchar(3) DEFAULT 'USD',
	"exchangeRate" text,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- User Settings table
CREATE TABLE IF NOT EXISTS "userSettings" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL UNIQUE,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"number_format" varchar(10) DEFAULT 'en-US' NOT NULL,
	"theme" "theme" DEFAULT 'dark' NOT NULL,
	"monthlySavingTarget" integer DEFAULT 0 NOT NULL,
	"hasUnreadArchived" boolean DEFAULT false NOT NULL,
	"wiseApiToken" text,
	"wiseWebhookSecret" text,
	"chatMemory" text
);

-- Recurring Expenses table
CREATE TABLE IF NOT EXISTS "recurringExpenses" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"frequency" "frequency" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"dayOfMonth" integer DEFAULT 1 NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Projects table (AQWorlds feature)
CREATE TABLE IF NOT EXISTS "projects" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(255),
	"amount" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"isPaid" boolean DEFAULT false NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Events table (AQWorlds calendar)
CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"month" integer NOT NULL,
	"isSelected" integer DEFAULT 0 NOT NULL,
	"isDefault" integer DEFAULT 0 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS "chatMessages" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"conversationFlow" varchar(50),
	"flowStep" integer
);

-- Monthly Payments table
CREATE TABLE IF NOT EXISTS "monthlyPayments" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"transactionId" integer,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- NEW FEATURE TABLES
-- ============================================================================

-- Budgets table
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"categoryId" integer NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"limitAmount" integer NOT NULL,
	"currentSpent" integer DEFAULT 0 NOT NULL,
	"alertThreshold" integer DEFAULT 75 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startDate" timestamp DEFAULT now() NOT NULL,
	"endDate" timestamp,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Bill Reminders table
CREATE TABLE IF NOT EXISTS "billReminders" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"categoryId" integer,
	"name" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"dueDay" integer NOT NULL,
	"frequency" "frequency" DEFAULT 'monthly' NOT NULL,
	"status" "bill_status" DEFAULT 'pending' NOT NULL,
	"lastPaidDate" timestamp,
	"nextDueDate" timestamp NOT NULL,
	"reminderDaysBefore" integer DEFAULT 3 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"autoCreateTransaction" boolean DEFAULT false NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- AI Insights table
CREATE TABLE IF NOT EXISTS "aiInsights" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"type" "insight_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"data" text,
	"isRead" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"validUntil" timestamp,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Category Learning table
CREATE TABLE IF NOT EXISTS "categoryLearning" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"categoryId" integer NOT NULL,
	"confidence" integer DEFAULT 1 NOT NULL,
	"lastUsed" timestamp DEFAULT now() NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Categories indexes
CREATE INDEX IF NOT EXISTS "categories_userId_idx" ON "categories" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "categories_isDefault_idx" ON "categories" USING btree ("isDefault");

-- Events indexes
CREATE INDEX IF NOT EXISTS "events_userId_idx" ON "events" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "events_month_idx" ON "events" USING btree ("month");
CREATE INDEX IF NOT EXISTS "events_userId_month_idx" ON "events" USING btree ("userId","month");

-- Goals indexes
CREATE INDEX IF NOT EXISTS "goals_userId_idx" ON "goals" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "goals_goalType_idx" ON "goals" USING btree ("goalType");

-- Projects indexes
CREATE INDEX IF NOT EXISTS "projects_userId_idx" ON "projects" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "projects_month_year_idx" ON "projects" USING btree ("month","year");
CREATE INDEX IF NOT EXISTS "projects_userId_month_year_idx" ON "projects" USING btree ("userId","month","year");

-- Transactions indexes
CREATE INDEX IF NOT EXISTS "transactions_userId_idx" ON "transactions" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "transactions_goalId_idx" ON "transactions" USING btree ("goalId");
CREATE INDEX IF NOT EXISTS "transactions_categoryId_idx" ON "transactions" USING btree ("categoryId");
CREATE INDEX IF NOT EXISTS "transactions_userId_goalId_idx" ON "transactions" USING btree ("userId","goalId");
CREATE INDEX IF NOT EXISTS "transactions_createdDate_idx" ON "transactions" USING btree ("createdDate");

-- Budgets indexes
CREATE INDEX IF NOT EXISTS "budgets_userId_idx" ON "budgets" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "budgets_categoryId_idx" ON "budgets" USING btree ("categoryId");
CREATE INDEX IF NOT EXISTS "budgets_userId_categoryId_idx" ON "budgets" USING btree ("userId","categoryId");

-- Bill Reminders indexes
CREATE INDEX IF NOT EXISTS "billReminders_userId_idx" ON "billReminders" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "billReminders_nextDueDate_idx" ON "billReminders" USING btree ("nextDueDate");
CREATE INDEX IF NOT EXISTS "billReminders_status_idx" ON "billReminders" USING btree ("status");

-- AI Insights indexes
CREATE INDEX IF NOT EXISTS "aiInsights_userId_idx" ON "aiInsights" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "aiInsights_type_idx" ON "aiInsights" USING btree ("type");
CREATE INDEX IF NOT EXISTS "aiInsights_isRead_idx" ON "aiInsights" USING btree ("isRead");
CREATE INDEX IF NOT EXISTS "aiInsights_createdDate_idx" ON "aiInsights" USING btree ("createdDate");

-- Category Learning indexes
CREATE INDEX IF NOT EXISTS "categoryLearning_userId_idx" ON "categoryLearning" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "categoryLearning_keyword_idx" ON "categoryLearning" USING btree ("keyword");
CREATE INDEX IF NOT EXISTS "categoryLearning_userId_keyword_idx" ON "categoryLearning" USING btree ("userId","keyword");

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all tables created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Show all enums created
SELECT 
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN (
    'user_role', 'goal_status', 'goal_type', 'transaction_type', 
    'theme', 'frequency', 'chat_role', 'budget_period', 
    'bill_status', 'insight_type'
)
GROUP BY typname
ORDER BY typname;

-- Count of indexes created
SELECT 
    COUNT(*) as total_indexes,
    'Indexes created successfully' as status
FROM pg_indexes 
WHERE schemaname = 'public';

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================