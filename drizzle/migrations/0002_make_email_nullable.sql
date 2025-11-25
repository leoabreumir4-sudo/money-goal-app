-- Make email column nullable to match schema definition
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
