-- Add unique constraint to openId if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_openId_unique'
    ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_openId_unique" UNIQUE("openId");
    END IF;
END $$;
