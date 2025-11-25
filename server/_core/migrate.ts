import { execSync } from "child_process";

const isProduction = process.env.NODE_ENV === "production";
const shouldSkip = process.env.SKIP_MIGRATE === "1" || process.env.SKIP_MIGRATIONS === "1";

function run(cmd: string) {
  console.log(`[Database] running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  if (shouldSkip) {
    console.log("[Database] SKIP_MIGRATE enabled — skipping migrations.");
    process.exit(0);
  }

  try {
    console.log("[Database] Running Drizzle migrations...");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    const db = drizzle(pool);
    
    // Run migrations from the drizzle folder
    await migrate(db, { migrationsFolder: "./drizzle" });
    
    console.log("[Database] Drizzle migrations completed successfully.");
    
    // Ensure openId unique constraint exists
    console.log("[Database] Checking openId unique constraint...");
    await pool.query(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'users_openId_unique'
          ) THEN
              ALTER TABLE "users" ADD CONSTRAINT "users_openId_unique" UNIQUE("openId");
              RAISE NOTICE 'Added unique constraint to openId';
          ELSE
              RAISE NOTICE 'Unique constraint already exists';
          END IF;
      END $$;
    `);
    
    // Make email column nullable
    console.log("[Database] Making email column nullable...");
    await pool.query(`
      ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
    `);
    console.log("[Database] Email column is now nullable.");
    
    console.log("[Database] All migrations and constraints applied successfully.");
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error("[Database] Migration failed:", err?.message ?? err);
    // Fail fast so deploys fail when migrations cannot be applied
    process.exit(1);
  }
}

main();
