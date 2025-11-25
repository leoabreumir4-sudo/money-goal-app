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
    if (isProduction) {
      console.log("[Database] Production detected — running `prisma migrate deploy`");
      // Apply already-created migrations without destructive reset
      run("npx prisma migrate deploy");
    } else {
      console.log("[Database] Development detected — running `prisma migrate dev`");
      // In development, allow iterative work. `--skip-generate` can be removed if you want generate to run.
      run("npx prisma migrate dev --skip-generate");
    }

    console.log("[Database] Migration finished.");
    process.exit(0);
  } catch (err: any) {
    console.error("[Database] Migration failed:", err?.message ?? err);
    // Fail fast so deploys fail when migrations cannot be applied
    process.exit(1);
  }
}

main();
