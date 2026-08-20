import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "prisma/schema.prisma",
  "prisma.config.ts",
  "auth.ts",
  "proxy.ts",
  "app/api/health/route.ts",
  "app/actions/sales.ts",
  "app/actions/topups.ts",
  "app/actions/preorders.ts",
  "app/admin/page.tsx",
  "app/cashier/page.tsx",
  "app/parent/register/page.tsx",
];

let failed = false;
for (const relative of required) {
  const exists = fs.existsSync(path.join(root, relative));
  console.log(`${exists ? "OK" : "MISSING"} ${relative}`);
  if (!exists) failed = true;
}

const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
for (const token of [
  "model Wallet",
  "parentId    String       @unique",
  "model WalletTransaction",
  "model Sale",
  "idempotencyKey",
  "model PreOrder",
  "refundOfSaleId",
]) {
  const exists = schema.includes(token);
  console.log(`${exists ? "OK" : "MISSING"} schema: ${token}`);
  if (!exists) failed = true;
}

const forbiddenImports = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", ".next"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      if (text.includes('from "@prisma/client"') || text.includes("from '@prisma/client'")) {
        forbiddenImports.push(path.relative(root, full));
      }
    }
  }
}
walk(root);
if (forbiddenImports.length) {
  failed = true;
  console.error("Legacy @prisma/client imports found:", forbiddenImports);
} else {
  console.log("OK Prisma imports use generated client path");
}

if (failed) process.exit(1);
console.log("Static project validation passed.");
