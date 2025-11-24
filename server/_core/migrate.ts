// server/_core/migrate.ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
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

  // O caminho para a pasta de migrações gerada pelo Drizzle-kit
  await migrate(db, { migrationsFolder: "drizzle" });

  console.log("[Database] Migration finished.");

  await pool.end();
}

runMigration().catch((err) => {
  console.error("[Database] Migration failed:", err);
  process.exit(1);
});
