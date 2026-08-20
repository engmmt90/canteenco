import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, UserRole, UserStatus } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  const school = await prisma.school.upsert({
    where: { code: "DEMO" },
    update: { name: "CanteenCo Demo School", isActive: true },
    create: {
      code: "DEMO",
      name: "CanteenCo Demo School",
      settings: {
        create: {
          timezone: "Australia/Brisbane",
          currency: "AUD",
          preOrderEnabled: true,
          preOrderCutoffTime: "07:00",
          allowNegativeBalance: true,
          minimumAllowedBalance: -10,
        },
      },
      pickupSlots: {
        create: [
          { label: "9:00–9:15", startTime: "09:00", endTime: "09:15", sortOrder: 1 },
          { label: "9:15–9:30", startTime: "09:15", endTime: "09:30", sortOrder: 2 },
          { label: "9:30–9:45", startTime: "09:30", endTime: "09:45", sortOrder: 3 },
        ],
      },
    },
  });

  const products = [
    { sku: "WATER", name: "Water", category: "Drinks", price: 2.0, sortOrder: 1 },
    { sku: "JUICE", name: "Juice", category: "Drinks", price: 3.0, sortOrder: 2 },
    { sku: "SANDWICH", name: "Sandwich", category: "Food", price: 6.0, sortOrder: 3 },
    { sku: "SNACK", name: "Snack", category: "Snacks", price: 2.5, sortOrder: 4 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
  }

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (superAdminEmail && superAdminPassword) {
    const passwordHash = await bcrypt.hash(superAdminPassword, 12);
    await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { fullName: "CanteenCo Super Admin", passwordHash, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      create: { fullName: "CanteenCo Super Admin", email: superAdminEmail, passwordHash, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });
  }

  const cashierEmail = process.env.SEED_CASHIER_EMAIL?.trim().toLowerCase();
  const cashierPassword = process.env.SEED_CASHIER_PASSWORD;
  if (cashierEmail && cashierPassword) {
    const passwordHash = await bcrypt.hash(cashierPassword, 12);
    await prisma.user.upsert({
      where: { email: cashierEmail },
      update: { fullName: "Demo Cashier", passwordHash, role: UserRole.CASHIER, status: UserStatus.ACTIVE, schoolId: school.id },
      create: { fullName: "Demo Cashier", email: cashierEmail, passwordHash, role: UserRole.CASHIER, status: UserStatus.ACTIVE, schoolId: school.id },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
