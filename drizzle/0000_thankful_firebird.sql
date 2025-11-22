CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('dark', 'light');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"color" varchar(7) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatMessages" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"month" integer NOT NULL,
	"isSelected" integer DEFAULT 0 NOT NULL,
	"isDefault" integer DEFAULT 0 NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"targetAmount" integer NOT NULL,
	"currentAmount" integer DEFAULT 0 NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL,
	"archivedDate" timestamp,
	"completedDate" timestamp
);
--> statement-breakpoint
CREATE TABLE "monthlyPayments" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"totalAmount" integer NOT NULL,
	"transactionId" integer,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(255),
	"amount" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"isPaid" boolean DEFAULT false NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurringExpenses" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"frequency" "frequency" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"goalId" integer NOT NULL,
	"categoryId" integer,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(255) NOT NULL,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"theme" "theme" DEFAULT 'dark' NOT NULL,
	"monthlySavingTarget" integer DEFAULT 0 NOT NULL,
	"hasUnreadArchived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "userSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
