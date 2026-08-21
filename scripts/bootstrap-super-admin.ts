import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

import {
  PrismaClient,
  UserRole,
  UserStatus,
} from "../generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL?.trim();

const bootstrapEmail =
  process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL
    ?.trim()
    .toLowerCase();

const bootstrapPassword =
  process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

const bootstrapName =
  process.env.BOOTSTRAP_SUPER_ADMIN_NAME
    ?.trim() || "CanteenCo Super Admin";

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required.",
  );
}

if (!bootstrapEmail) {
  throw new Error(
    "BOOTSTRAP_SUPER_ADMIN_EMAIL is required.",
  );
}

if (
  !bootstrapPassword ||
  bootstrapPassword.length < 12
) {
  throw new Error(
    "BOOTSTRAP_SUPER_ADMIN_PASSWORD must be at least 12 characters.",
  );
}

/*
 * After the guards above, copy the values into
 * explicitly typed constants so TypeScript knows
 * they cannot be undefined inside async functions.
 */
const email: string = bootstrapEmail;
const password: string =
  bootstrapPassword;

const adapter = new PrismaNeon({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main(): Promise<void> {
  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (
    existing &&
    existing.role !==
      UserRole.SUPER_ADMIN
  ) {
    throw new Error(
      "That email already belongs to a non-Super-Admin user.",
    );
  }

  const passwordHash: string =
    await bcrypt.hash(password, 12);

  const user =
    await prisma.user.upsert({
      where: {
        email,
      },
      update: {
        fullName: bootstrapName,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        fullName: bootstrapName,
        email,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

  console.log(
    `Super Admin ready: ${user.email}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });