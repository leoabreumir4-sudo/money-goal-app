CREATE TYPE "public"."bill_status" AS ENUM('pending', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('savings', 'emergency', 'general');--> statement-breakpoint
CREATE TYPE "public"."insight_type" AS ENUM('forecast', 'alert', 'suggestion', 'achievement');--> statement-breakpoint
CREATE TABLE "aiInsights" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "billReminders" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "categoryLearning" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"categoryId" integer NOT NULL,
	"confidence" integer DEFAULT 1 NOT NULL,
	"lastUsed" timestamp DEFAULT now() NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "goalType" "goal_type" DEFAULT 'savings' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "monthlyContribution" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "targetDate" timestamp;--> statement-breakpoint
CREATE INDEX "aiInsights_userId_idx" ON "aiInsights" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "aiInsights_type_idx" ON "aiInsights" USING btree ("type");--> statement-breakpoint
CREATE INDEX "aiInsights_isRead_idx" ON "aiInsights" USING btree ("isRead");--> statement-breakpoint
CREATE INDEX "aiInsights_createdDate_idx" ON "aiInsights" USING btree ("createdDate");--> statement-breakpoint
CREATE INDEX "billReminders_userId_idx" ON "billReminders" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "billReminders_nextDueDate_idx" ON "billReminders" USING btree ("nextDueDate");--> statement-breakpoint
CREATE INDEX "billReminders_status_idx" ON "billReminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "budgets_userId_idx" ON "budgets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "budgets_categoryId_idx" ON "budgets" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "budgets_userId_categoryId_idx" ON "budgets" USING btree ("userId","categoryId");--> statement-breakpoint
CREATE INDEX "categoryLearning_userId_idx" ON "categoryLearning" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "categoryLearning_keyword_idx" ON "categoryLearning" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "categoryLearning_userId_keyword_idx" ON "categoryLearning" USING btree ("userId","keyword");--> statement-breakpoint
CREATE INDEX "goals_goalType_idx" ON "goals" USING btree ("goalType");