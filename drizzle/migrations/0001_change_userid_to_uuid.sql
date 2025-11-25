-- Change users.id from serial to uuid
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "id" TYPE uuid USING gen_random_uuid();
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Change all userId foreign keys to uuid
ALTER TABLE "goals" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "categories" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "transactions" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "userSettings" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "recurringExpenses" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "projects" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "events" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "chatMessages" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
ALTER TABLE "monthlyPayments" ALTER COLUMN "userId" TYPE uuid USING gen_random_uuid();
