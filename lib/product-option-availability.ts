"use server";

import { prisma } from "@/lib/prisma";

export async function ensureProductOptionSchoolAvailabilityTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductOptionSchoolAvailability" (
      "optionId" TEXT NOT NULL,
      "schoolId" TEXT NOT NULL,
      "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "ProductOptionSchoolAvailability_pkey"
        PRIMARY KEY ("optionId", "schoolId")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS
      "ProductOptionSchoolAvailability_schoolId_idx"
    ON "ProductOptionSchoolAvailability" ("schoolId")
  `);
}

export async function getBlockedProductOptionIds(
  schoolId: string,
) {
  await ensureProductOptionSchoolAvailabilityTable();

  const rows = await prisma.$queryRaw<
    Array<{ optionId: string }>
  >`
    SELECT "optionId"
    FROM "ProductOptionSchoolAvailability"
    WHERE "schoolId" = ${schoolId}
      AND "isAvailable" = FALSE
  `;

  return new Set(
    rows.map((row) => row.optionId),
  );
}

export async function getBlockedSchoolIdsByProductOption() {
  await ensureProductOptionSchoolAvailabilityTable();

  return prisma.$queryRaw<
    Array<{
      optionId: string;
      schoolId: string;
    }>
  >`
    SELECT "optionId", "schoolId"
    FROM "ProductOptionSchoolAvailability"
    WHERE "isAvailable" = FALSE
  `;
}

export async function setProductOptionAvailabilityForSchools(
  optionId: string,
  managedSchoolIds: string[],
  availableSchoolIds: string[],
) {
  await ensureProductOptionSchoolAvailabilityTable();

  const available = new Set(availableSchoolIds);

  for (const schoolId of managedSchoolIds) {
    if (available.has(schoolId)) {
      await prisma.$executeRaw`
        DELETE FROM "ProductOptionSchoolAvailability"
        WHERE "optionId" = ${optionId}
          AND "schoolId" = ${schoolId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ProductOptionSchoolAvailability"
          ("optionId", "schoolId", "isAvailable", "updatedAt")
        VALUES
          (${optionId}, ${schoolId}, FALSE, NOW())
        ON CONFLICT ("optionId", "schoolId")
        DO UPDATE SET
          "isAvailable" = FALSE,
          "updatedAt" = NOW()
      `;
    }
  }
}
