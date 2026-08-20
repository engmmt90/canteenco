import process from "node:process";

const required = ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "NOTIFICATION_WORKER_SECRET"];
const optionalGroups = [
  ["RESEND_API_KEY", "NOTIFICATION_EMAIL_FROM"],
  ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
];

const missing = required.filter((key) => !process.env[key]?.trim());
const pooled = process.env.DATABASE_URL || "";
const direct = process.env.DIRECT_URL || "";

console.log("CanteenCo environment doctor");
for (const key of required) console.log(`${key}: ${process.env[key]?.trim() ? "OK" : "MISSING"}`);

if (pooled && !/postgres(ql)?:\/\//.test(pooled)) console.error("DATABASE_URL is not a PostgreSQL URL.");
if (direct && !/postgres(ql)?:\/\//.test(direct)) console.error("DIRECT_URL is not a PostgreSQL URL.");
if (pooled && direct && pooled === direct) console.warn("Warning: DATABASE_URL and DIRECT_URL are identical. Neon production setup should normally use pooled app URL + direct migration URL.");
if ((process.env.AUTH_SECRET || "").length < 32) console.error("AUTH_SECRET must be at least 32 characters.");
if ((process.env.NOTIFICATION_WORKER_SECRET || "").length < 32) console.error("NOTIFICATION_WORKER_SECRET must be at least 32 characters.");

for (const group of optionalGroups) {
  const set = group.filter(k => process.env[k]?.trim());
  if (set.length > 0 && set.length !== group.length) console.warn(`Partial provider configuration: ${group.join(", ")}`);
}

if (missing.length) {
  console.error(`Missing required variables: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Required environment variables are present.");
