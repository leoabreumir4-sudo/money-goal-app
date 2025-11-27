ALTER TABLE "categories" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "keywords" text[];--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "isDefault" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "createdDate" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recurringExpenses" ADD COLUMN "dayOfMonth" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "exchangeRate" text;