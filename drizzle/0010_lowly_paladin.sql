ALTER TABLE "users" ADD COLUMN "phone_number" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified" boolean DEFAULT false;