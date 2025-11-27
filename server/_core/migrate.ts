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
    console.log("[Database] Starting migration process...");
    console.log(`[Database] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Database] DATABASE_URL: ${process.env.DATABASE_URL ? '***configured***' : 'MISSING'}`);
    
    const startTime = Date.now();
    
    console.log("[Database] Importing drizzle dependencies...");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    
    console.log("[Database] Creating database connection pool...");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 30000, // 30 second timeout
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    
    console.log("[Database] Testing database connection...");
    await pool.query('SELECT NOW()', { timeout: 30000 });
    console.log("[Database] ✅ Database connection successful");
    
    const db = drizzle(pool);
    
    // Run migrations from the drizzle/migrations folder
    console.log("[Database] Migrations folder: ./drizzle/migrations");
    console.log("[Database] Running migrations...");
    
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Database] ✅ Migrations completed successfully in ${elapsed}s`);
    
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error("[Database] ❌ Migration failed:", err?.message ?? err);
    console.error("[Database] Stack trace:", err?.stack);
    // Fail fast so deploys fail when migrations cannot be applied
    process.exit(1);
  }
}

main();
