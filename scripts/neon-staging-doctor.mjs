import process from "node:process";

function parse(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} is not a valid URL`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error(`${name} must be PostgreSQL`);
  if (url.searchParams.get("sslmode") !== "require") console.warn(`${name}: sslmode=require is strongly recommended`);
  return url;
}

const pooled = parse("DATABASE_URL");
const direct = parse("DIRECT_URL");

console.log("CanteenCo Neon staging doctor");
console.log(`DATABASE_URL host: ${pooled.hostname}`);
console.log(`DIRECT_URL host:   ${direct.hostname}`);

if (!pooled.hostname.includes("-pooler.")) {
  throw new Error("DATABASE_URL does not look like a Neon pooled hostname (expected '-pooler' in host).");
}
if (direct.hostname.includes("-pooler.")) {
  throw new Error("DIRECT_URL must be the direct Neon hostname, not the pooler.");
}
if (pooled.pathname !== direct.pathname) {
  throw new Error("DATABASE_URL and DIRECT_URL point to different database names.");
}

const pooledBase = pooled.hostname.replace("-pooler.", ".");
if (pooledBase !== direct.hostname) {
  console.warn("Pooled and direct hosts do not appear to belong to the same Neon endpoint. Verify they are from the same branch.");
}

if ((process.env.NODE_ENV || "") === "production") {
  throw new Error("This staging doctor refuses NODE_ENV=production.");
}
if (process.env.ALLOW_DEMO_SEED === "true") {
  console.warn("ALLOW_DEMO_SEED=true: acceptable only on a disposable staging/development branch.");
}

console.log("Neon staging connection layout looks correct.");
