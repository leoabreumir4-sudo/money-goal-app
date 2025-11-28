-- Migration 0012 e 0013: Adicionar novas funcionalidades financeiras (SAFE VERSION)
-- Este script ignora enums que já existem e cria apenas o que falta

-- 1. Criar novos enums (com proteção contra duplicatas)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_type') THEN
        CREATE TYPE "public"."goal_type" AS ENUM('savings', 'emergency', 'general');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_period') THEN
        CREATE TYPE "public"."budget_period" AS ENUM('weekly', 'monthly', 'yearly');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
        CREATE TYPE "public"."bill_status" AS ENUM('pending', 'paid', 'overdue');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insight_type') THEN
        CREATE TYPE "public"."insight_type" AS ENUM('forecast', 'alert', 'suggestion', 'achievement');
    END IF;
END $$;

-- 2. Criar tabela de budgets (orçamentos)
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"categoryId" integer,
	"name" varchar(255) NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"limitAmount" integer NOT NULL,
	"currentAmount" integer DEFAULT 0 NOT NULL,
	"alertThreshold" integer DEFAULT 80 NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- 3. Criar tabela de bill reminders (lembretes de contas)
CREATE TABLE IF NOT EXISTS "billReminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"categoryId" integer,
	"name" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"dueDay" integer NOT NULL,
	"frequency" "frequency" DEFAULT 'monthly' NOT NULL,
	"status" "bill_status" DEFAULT 'pending' NOT NULL,
	"reminderDaysBefore" integer DEFAULT 3 NOT NULL,
	"autoCreateTransaction" boolean DEFAULT false NOT NULL,
	"lastPaidDate" timestamp,
	"nextDueDate" timestamp NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"notes" text
);

-- 4. Criar tabela de AI insights (insights de IA)
CREATE TABLE IF NOT EXISTS "aiInsights" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"type" "insight_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"data" text,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);

-- 5. Criar tabela de category learning (aprendizado de categorias)
CREATE TABLE IF NOT EXISTS "categoryLearning" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"categoryId" integer NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"usageCount" integer DEFAULT 1 NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- 6. Modificar tabela goals (adicionar novas colunas)
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "goalType" "goal_type" DEFAULT 'savings' NOT NULL;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 0 NOT NULL;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "monthlyContribution" integer;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "targetDate" timestamp;

-- 7. Criar indexes para performance
-- Budgets indexes
CREATE INDEX IF NOT EXISTS "budgets_userId_idx" ON "budgets" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "budgets_categoryId_idx" ON "budgets" USING btree ("categoryId");
CREATE INDEX IF NOT EXISTS "budgets_period_idx" ON "budgets" USING btree ("period");

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
CREATE INDEX IF NOT EXISTS "categoryLearning_categoryId_idx" ON "categoryLearning" USING btree ("categoryId");

-- Goals new indexes
CREATE INDEX IF NOT EXISTS "goals_goalType_idx" ON "goals" USING btree ("goalType");

-- Concluído! Script executado com sucesso.
