import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, UserRole, UserStatus } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
const fullName = process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim() || "CanteenCo Super Admin";

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!email) throw new Error("BOOTSTRAP_SUPER_ADMIN_EMAIL is required.");
if (!password || password.length < 12) throw new Error("BOOTSTRAP_SUPER_ADMIN_PASSWORD must be at least 12 characters.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== UserRole.SUPER_ADMIN) throw new Error("That email already belongs to a non-Super-Admin user.");
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { fullName, passwordHash, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, deletedAt: null },
    create: { fullName, email, passwordHash, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
  });
  console.log(`Super Admin ready: ${user.email}`);
}

main().catch((error)=>{console.error(error);process.exitCode=1}).finally(async()=>{await prisma.$disconnect()});
