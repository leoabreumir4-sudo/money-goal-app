// server/_core/migrate.ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("[Database] Migration started...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true, // Adicionar SSL para Neon
  });

  const db = drizzle(pool);

  // Workaround for "type already exists" error on subsequent deploys
  // This is a temporary fix, a proper migration strategy should be used
  await db.execute(sql`DROP TYPE IF EXISTS "public"."chat_role" CASCADE;`);
  console.log("[Database] Dropped chat_role type (if existed).");
  await db.execute(sql`DROP TYPE IF EXISTS "public"."frequency" CASCADE;`);
  console.log("[Database] Dropped frequency type (if existed).");
  await db.execute(sql`DROP TYPE IF EXISTS "public"."goal_status" CASCADE;`);
  console.log("[Database] Dropped goal_status type (if existed).");
  await db.execute(sql`DROP TYPE IF EXISTS "public"."theme" CASCADE;`);
  console.log("[Database] Dropped theme type (if existed).");
  await db.execute(sql`DROP TYPE IF EXISTS "public"."transaction_type" CASCADE;`);
  console.log("[Database] Dropped transaction_type type (if existed).");
  await db.execute(sql`DROP TYPE IF EXISTS "public"."user_role" CASCADE;`);
  console.log("[Database] Dropped user_role type (if existed).");
  await db.execute(sql`DROP TABLE IF EXISTS "categories" CASCADE;`);
  console.log("[Database] Dropped categories table (if existed).");

  // O caminho para a pasta de migrações gerada pelo Drizzle-kit
  await migrate(db, { migrationsFolder: "drizzle" });

  console.log("[Database] Migration finished.");

  await pool.end();
}

runMigration().catch((err) => {
  console.error("[Database] Migration failed:", err);
  process.exit(1);
});
