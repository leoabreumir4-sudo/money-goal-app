-- ============================================================================
-- RESET COMPLETO DO BANCO - SOLUÇÃO DEFINITIVA
-- ============================================================================
-- ⚠️  ATENÇÃO: Este script VAI DELETAR TUDO e recriar do zero
-- Só execute se quiser começar limpo!

-- 1. DELETAR TUDO
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 2. RECRIAR TODOS OS ENUMS
CREATE TYPE "user_role" AS ENUM('user', 'admin');
CREATE TYPE "goal_type" AS ENUM('savings', 'emergency', 'general');
CREATE TYPE "transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "theme" AS ENUM('dark', 'light');
CREATE TYPE "frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
CREATE TYPE "chat_role" AS ENUM('user', 'assistant', 'system');
CREATE TYPE "budget_period" AS ENUM('weekly', 'monthly', 'yearly');
CREATE TYPE "bill_status" AS ENUM('pending', 'paid', 'overdue');
CREATE TYPE "insight_type" AS ENUM('forecast', 'alert', 'suggestion', 'achievement');

-- 3. RECRIAR TODAS AS TABELAS PRINCIPAIS
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

CREATE TABLE "goals" (
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

CREATE TABLE "chatMessages" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"conversationFlow" varchar(50),
	"flowStep" integer
);

CREATE TABLE "monthlyPayments" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"transactionId" integer,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

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

CREATE TABLE "categoryLearning" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"categoryId" integer NOT NULL,
	"confidence" integer DEFAULT 1 NOT NULL,
	"lastUsed" timestamp DEFAULT now() NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- 4. VERIFICAÇÃO FINAL
SELECT 
    COUNT(*) as total_tables,
    'BANCO RESETADO COM SUCESSO!' as status
FROM pg_tables 
WHERE schemaname = 'public';

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;