import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDir = path.join(root, "prisma/migrations");
const env = process.env.NODE_ENV || "development";

console.log(`Migration preflight (${env})`);

if (!fs.existsSync(path.join(root, "prisma/schema.prisma"))) {
  console.error("Missing prisma/schema.prisma");
  process.exit(1);
}

const migrations = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
  : [];

console.log(`Committed migrations: ${migrations.length}`);

if (env === "production" && migrations.length === 0) {
  console.error("Production deploy blocked: no committed Prisma migration exists.");
  console.error("Generate and review the initial migration in a controlled development/staging database first.");
  process.exit(1);
}

if (process.env.ALLOW_DEMO_SEED === "true" && env === "production") {
  console.error("Production deploy blocked: ALLOW_DEMO_SEED=true.");
  process.exit(1);
}

console.log("Migration preflight passed.");
