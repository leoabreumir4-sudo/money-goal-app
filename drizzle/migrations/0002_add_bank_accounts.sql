-- Add bankAccounts table for Plaid integration
CREATE TABLE "bankAccounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"plaidItemId" varchar(255) NOT NULL,
	"plaidAccessToken" text NOT NULL,
	"institutionName" varchar(255),
	"institutionId" varchar(255),
	"accountIds" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSyncDate" timestamp,
	"createdDate" timestamp DEFAULT now() NOT NULL
);
