-- ============================================================================
-- RESET TOTAL + CRIAÇÃO PERFEITA DA DATABASE - MONEY GOAL APP
-- ⚠️ ESTE SCRIPT VAI APAGAR TUDO E RECRIAR DO ZERO ⚠️
-- Execute TUDO de uma vez no Neon SQL Editor
-- ============================================================================

-- 🔥 PASSO 1: RESET COMPLETO
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 🔧 PASSO 2: CRIAR TODOS OS ENUMS (baseado no schema.ts REAL)
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

-- 🏗️ PASSO 3: CRIAR TODAS AS TABELAS (EXATAMENTE como no schema.ts)

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE "users" (
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

-- ============================================================================
-- GOALS TABLE (COM STATUS E SEM CONFLITOS)
-- ============================================================================
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"goalType" "goal_type" DEFAULT 'savings' NOT NULL,
	"targetAmount" integer NOT NULL,
	"currentAmount" integer DEFAULT 0 NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"monthlyContribution" integer,
	"targetDate" timestamp,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"archivedDate" timestamp,
	"completedDate" timestamp
);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"userId" uuid,
	"name" varchar(255) NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"color" varchar(7) NOT NULL,
	"keywords" text[],
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE "transactions" (
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

-- ============================================================================
-- USER SETTINGS TABLE
-- ============================================================================
CREATE TABLE "userSettings" (
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

-- ============================================================================
-- RECURRING EXPENSES TABLE
-- ============================================================================
CREATE TABLE "recurringExpenses" (
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

-- ============================================================================
-- PROJECTS TABLE (AQWORLDS)
-- ============================================================================
CREATE TABLE "projects" (
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

-- ============================================================================
-- EVENTS TABLE (AQWORLDS CALENDAR)
-- ============================================================================
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"month" integer NOT NULL,
	"isSelected" integer DEFAULT 0 NOT NULL,
	"isDefault" integer DEFAULT 0 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================
CREATE TABLE "chatMessages" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"conversationFlow" varchar(50),
	"flowStep" integer
);

-- ============================================================================
-- MONTHLY PAYMENTS TABLE
-- ============================================================================
CREATE TABLE "monthlyPayments" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"transactionId" integer,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- ============================================================================
-- BUDGETS TABLE
-- ============================================================================
CREATE TABLE "budgets" (
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

-- ============================================================================
-- BILL REMINDERS TABLE
-- ============================================================================
CREATE TABLE "billReminders" (
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

-- ============================================================================
-- AI INSIGHTS TABLE
-- ============================================================================
CREATE TABLE "aiInsights" (
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

-- ============================================================================
-- CATEGORY LEARNING TABLE
-- ============================================================================
CREATE TABLE "categoryLearning" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"categoryId" integer NOT NULL,
	"confidence" integer DEFAULT 1 NOT NULL,
	"lastUsed" timestamp DEFAULT now() NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- 🚀 PASSO 4: CRIAR TODOS OS ÍNDICES PARA PERFORMANCE

-- Goals indexes
CREATE INDEX "goals_userId_idx" ON "goals" USING btree ("userId");
CREATE INDEX "goals_status_idx" ON "goals" USING btree ("status");
CREATE INDEX "goals_userId_status_idx" ON "goals" USING btree ("userId","status");
CREATE INDEX "goals_goalType_idx" ON "goals" USING btree ("goalType");

-- Categories indexes
CREATE INDEX "categories_userId_idx" ON "categories" USING btree ("userId");
CREATE INDEX "categories_isDefault_idx" ON "categories" USING btree ("isDefault");

-- Transactions indexes
CREATE INDEX "transactions_userId_idx" ON "transactions" USING btree ("userId");
CREATE INDEX "transactions_goalId_idx" ON "transactions" USING btree ("goalId");
CREATE INDEX "transactions_categoryId_idx" ON "transactions" USING btree ("categoryId");
CREATE INDEX "transactions_userId_goalId_idx" ON "transactions" USING btree ("userId","goalId");
CREATE INDEX "transactions_createdDate_idx" ON "transactions" USING btree ("createdDate");

-- Projects indexes
CREATE INDEX "projects_userId_idx" ON "projects" USING btree ("userId");
CREATE INDEX "projects_month_year_idx" ON "projects" USING btree ("month","year");
CREATE INDEX "projects_userId_month_year_idx" ON "projects" USING btree ("userId","month","year");

-- Events indexes
CREATE INDEX "events_userId_idx" ON "events" USING btree ("userId");
CREATE INDEX "events_month_idx" ON "events" USING btree ("month");
CREATE INDEX "events_userId_month_idx" ON "events" USING btree ("userId","month");

-- Budgets indexes
CREATE INDEX "budgets_userId_idx" ON "budgets" USING btree ("userId");
CREATE INDEX "budgets_categoryId_idx" ON "budgets" USING btree ("categoryId");
CREATE INDEX "budgets_userId_categoryId_idx" ON "budgets" USING btree ("userId","categoryId");

-- Bill Reminders indexes
CREATE INDEX "billReminders_userId_idx" ON "billReminders" USING btree ("userId");
CREATE INDEX "billReminders_nextDueDate_idx" ON "billReminders" USING btree ("nextDueDate");
CREATE INDEX "billReminders_status_idx" ON "billReminders" USING btree ("status");

-- AI Insights indexes
CREATE INDEX "aiInsights_userId_idx" ON "aiInsights" USING btree ("userId");
CREATE INDEX "aiInsights_type_idx" ON "aiInsights" USING btree ("type");
CREATE INDEX "aiInsights_isRead_idx" ON "aiInsights" USING btree ("isRead");
CREATE INDEX "aiInsights_createdDate_idx" ON "aiInsights" USING btree ("createdDate");

-- Category Learning indexes
CREATE INDEX "categoryLearning_userId_idx" ON "categoryLearning" USING btree ("userId");
CREATE INDEX "categoryLearning_keyword_idx" ON "categoryLearning" USING btree ("keyword");
CREATE INDEX "categoryLearning_userId_keyword_idx" ON "categoryLearning" USING btree ("userId","keyword");

-- ✅ PASSO 5: VERIFICAÇÃO FINAL
SELECT 
    'ENUMS' as tipo,
    COUNT(*) as quantidade
FROM pg_type t 
WHERE t.typname IN ('user_role', 'goal_status', 'goal_type', 'transaction_type', 'theme', 'frequency', 'chat_role', 'budget_period', 'bill_status', 'insight_type')

UNION ALL

SELECT 
    'TABELAS' as tipo,
    COUNT(*) as quantidade
FROM pg_tables 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'INDEXES' as tipo,
    COUNT(*) as quantidade
FROM pg_indexes 
WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey';

-- Listar todas as tabelas criadas
SELECT 
    tablename,
    '✅ CRIADA' as status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- ============================================================================
-- 🎉 DATABASE RESETADA E RECRIADA COM SUCESSO!
-- Agora o app deve funcionar 100% sem erros!
-- ============================================================================