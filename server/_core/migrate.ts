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
    // Use drizzle-kit push for production (applies schema directly)
    // Or use migrate command if you have migration files
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
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error("[Database] Migration failed:", err?.message ?? err);
    // Fail fast so deploys fail when migrations cannot be applied
    process.exit(1);
  }
}

main();
