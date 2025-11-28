-- CRIAR TODAS AS TABELAS FALTANTES - Execute uma por vez
-- Execute este SQL no Neon linha por linha ou seção por seção

-- ============================================================================
-- 1. CRIAR TABELA GOALS (se não existir)
-- ============================================================================
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

-- ============================================================================
-- 2. CRIAR TABELA TRANSACTIONS (se não existir)
-- ============================================================================
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

-- ============================================================================
-- 3. CRIAR TABELA USERSETTINGS (se não existir)
-- ============================================================================
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

-- ============================================================================
-- 4. VERIFICAR SE AS TABELAS FORAM CRIADAS
-- ============================================================================
SELECT 
    tablename,
    'EXISTS' as status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('goals', 'transactions', 'userSettings')
ORDER BY tablename;