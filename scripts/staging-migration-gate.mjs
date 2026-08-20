import fs from "node:fs";
import path from "node:path";
import process from "node:process";

if (process.env.NODE_ENV === "production") throw new Error("Staging migration gate refuses production.");
if (!process.env.STAGING_DATABASE_ACK || process.env.STAGING_DATABASE_ACK !== "CANTEENCO_STAGING") {
  throw new Error('Set STAGING_DATABASE_ACK="CANTEENCO_STAGING" to confirm this is a staging database.');
}

const migrations = path.join(process.cwd(), "prisma", "migrations");
if (!fs.existsSync(migrations)) {
  console.log("No committed migrations yet. Generate the initial migration only from a controlled staging/development database with `prisma migrate dev --name init`.");
  process.exit(2);
}

const dirs = fs.readdirSync(migrations, { withFileTypes: true }).filter(x => x.isDirectory());
if (!dirs.length) {
  console.log("Migration directory exists but contains no migration folders.");
  process.exit(2);
}

console.log(`Staging gate passed with ${dirs.length} committed migration(s).`);
