import { execSync } from "child_process";

/**
 * Production start script that handles migrations and server startup
 * This replaces the shell script to work cross-platform
 */
async function main() {
  try {
    console.log("[Start] Starting MoneyGoal production server...");
    console.log("[Start] NODE_ENV:", process.env.NODE_ENV);
    console.log("[Start] MIGRATE:", process.env.MIGRATE);
    
    // Run migrations if MIGRATE=1
    if (process.env.MIGRATE === "1") {
      console.log("[Start] Running migrations...");
      execSync("tsx server/_core/migrate.ts", { stdio: "inherit" });
      console.log("[Start] Migrations completed");
    } else {
      console.log("[Start] Skipping migrations (MIGRATE != 1)");
    }
    
    // Set NODE_ENV to production
    process.env.NODE_ENV = "production";
    
    console.log("[Start] Starting server...");
    
    // Import and start server
    await import("./index.js");
  } catch (error: any) {
    console.error("[Start] Failed to start server:", error?.message ?? error);
    console.error("[Start] Stack trace:", error?.stack);
    process.exit(1);
  }
}

main();
