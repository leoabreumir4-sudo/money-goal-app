-- Create all tables with correct UUID types
-- Run this in Neon SQL Editor

-- Create enums
CREATE TYPE "user_role" AS ENUM('user', 'admin');
CREATE TYPE "goal_status" AS ENUM('active', 'archived');
CREATE TYPE "transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "theme" AS ENUM('dark', 'light');
CREATE TYPE "frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
CREATE TYPE "chat_role" AS ENUM('user', 'assistant', 'system');

-- Create users table with UUID
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"openId" varchar(64) NOT NULL UNIQUE,
	"passwordHash" text,
	"name" text,
	"email" varchar(320),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL
);

-- Create goals table
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"targetAmount" integer NOT NULL,
	"currentAmount" integer DEFAULT 0 NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"archivedDate" timestamp,
	"completedDate" timestamp
);

-- Create categories table
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"color" varchar(7) NOT NULL
);

-- Create transactions table
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"goalId" integer NOT NULL,
	"categoryId" integer,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(255) NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Create userSettings table
CREATE TABLE "userSettings" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL UNIQUE,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"theme" "theme" DEFAULT 'dark' NOT NULL,
	"monthlySavingTarget" integer DEFAULT 0 NOT NULL,
	"hasUnreadArchived" boolean DEFAULT false NOT NULL
);

-- Create recurringExpenses table
CREATE TABLE "recurringExpenses" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"frequency" "frequency" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Create projects table
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

-- Create events table
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"month" integer NOT NULL,
	"isSelected" integer DEFAULT 0 NOT NULL,
	"isDefault" integer DEFAULT 0 NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Create chatMessages table
CREATE TABLE "chatMessages" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Create monthlyPayments table
CREATE TABLE "monthlyPayments" (
	"id" serial PRIMARY KEY,
	"userId" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"transactionId" integer,
	"createdDate" timestamp DEFAULT now() NOT NULL
);

-- Verify tables were created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
