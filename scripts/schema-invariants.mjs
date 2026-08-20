import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "prisma/schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");

const required = [
  "model Wallet",
  "parentId    String       @unique",
  "model WalletTransaction",
  "refundOfSaleId String?",
  '@relation("SaleDebitTransaction")',
  '@relation("SaleRefundTransactions")',
  "model ClassStudentSequence",
  "@@unique([schoolId, classCode])",
  "@@unique([schoolId, classCode, sequenceNumber])",
  "idempotencyKey       String     @unique",
  "idempotencyKey  String         @unique",
  "productNameSnapshot String",
];

let failed = false;
for (const token of required) {
  const ok = schema.includes(token);
  console.log(`${ok ? "OK" : "MISSING"} ${token}`);
  if (!ok) failed = true;
}

if (schema.includes("walletId             String") && schema.includes("parentId    String       @unique")) {
  console.log("OK family wallet remains parent-scoped");
} else {
  console.error("Family wallet invariant could not be confirmed.");
  failed = true;
}

if (failed) process.exit(1);
console.log("Schema invariants passed.");
