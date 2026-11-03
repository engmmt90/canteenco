import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as neonPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
attachDatabasePool(pool);
const pgPrisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function measure(client: PrismaClient) {
  const start = performance.now();
  await client.$queryRaw`SELECT 1 AS value`;
  return Math.round(performance.now() - start);
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }
  try {
    const neonMs: number[] = [];
    const pgMs: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (i % 2 === 0) {
        neonMs.push(await measure(neonPrisma));
        pgMs.push(await measure(pgPrisma));
      } else {
        pgMs.push(await measure(pgPrisma));
        neonMs.push(await measure(neonPrisma));
      }
    }
    return Response.json({ neonMs, pgMs });
  } catch {
    return Response.json({ error: "Benchmark unavailable" }, { status: 500 });
  }
}
