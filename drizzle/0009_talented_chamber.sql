ALTER TABLE "chatMessages" ADD COLUMN "conversationFlow" varchar(50);--> statement-breakpoint
ALTER TABLE "chatMessages" ADD COLUMN "flowStep" integer;