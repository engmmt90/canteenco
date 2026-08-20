import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const [schools, products, users] = await Promise.all([
    prisma.school.count(),
    prisma.product.count(),
    prisma.user.count(),
  ]);
  console.log(JSON.stringify({ database: "ok", schools, products, users }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
