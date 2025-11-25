// server/_core/migrate.ts
// Safe, idempotent migration runner for Drizzle ORM
// This script applies pending migrations without dropping tables or types
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

async function runMigration() {
  const isProduction = process.env.NODE_ENV === "production";
  const env = isProduction ? "production" : "development";

  if (!process.env.DATABASE_URL) {
    console.error("[Database] DATABASE_URL is not set");
    process.exit(1);
  }

  console.log(`[Database] Migration started in ${env} mode...`);
  console.log("[Database] Running safe, idempotent migration (no destructive operations)...");

  // SSL configuration: In production, enable SSL for secure connections
  // Most cloud database providers (Neon, Supabase, etc.) require SSL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? true : undefined,
  });

  const db = drizzle(pool);

  try {
    // Drizzle's migrate() is idempotent: it tracks applied migrations in a journal
    // and only applies new migrations that haven't been run yet.
    // It does NOT drop tables, types, or reset the database.
    await migrate(db, { migrationsFolder: "drizzle" });

    console.log("[Database] Migration completed successfully.");
  } catch (err) {
    console.error("[Database] Migration failed:", err);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  console.log("[Database] Database connection closed.");
}

runMigration().catch((err) => {
  console.error("[Database] Unexpected migration error:", err);
  process.exit(1);
});
