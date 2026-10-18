import { prisma } from "@/lib/prisma";

export async function ensureProductSchoolAvailabilityTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductSchoolAvailability" (
      "productId" TEXT NOT NULL,
      "schoolId" TEXT NOT NULL,
      "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "ProductSchoolAvailability_pkey"
        PRIMARY KEY ("productId", "schoolId")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS
      "ProductSchoolAvailability_schoolId_idx"
    ON "ProductSchoolAvailability" ("schoolId")
  `);
}

export async function getBlockedProductIds(
  schoolId: string,
) {
  await ensureProductSchoolAvailabilityTable();

  const rows = await prisma.$queryRaw<
    Array<{ productId: string }>
  >`
    SELECT "productId"
    FROM "ProductSchoolAvailability"
    WHERE "schoolId" = ${schoolId}
      AND "isAvailable" = FALSE
  `;

  return new Set(
    rows.map((row) => row.productId),
  );
}

export async function getBlockedSchoolIdsByProduct() {
  await ensureProductSchoolAvailabilityTable();

  return prisma.$queryRaw<
    Array<{
      productId: string;
      schoolId: string;
    }>
  >`
    SELECT "productId", "schoolId"
    FROM "ProductSchoolAvailability"
    WHERE "isAvailable" = FALSE
  `;
}

export async function setProductAvailabilityForSchools(
  productId: string,
  managedSchoolIds: string[],
  availableSchoolIds: string[],
) {
  await ensureProductSchoolAvailabilityTable();

  const available = new Set(availableSchoolIds);

  for (const schoolId of managedSchoolIds) {
    if (available.has(schoolId)) {
      await prisma.$executeRaw`
        DELETE FROM "ProductSchoolAvailability"
        WHERE "productId" = ${productId}
          AND "schoolId" = ${schoolId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ProductSchoolAvailability"
          ("productId", "schoolId", "isAvailable", "updatedAt")
        VALUES
          (${productId}, ${schoolId}, FALSE, NOW())
        ON CONFLICT ("productId", "schoolId")
        DO UPDATE SET
          "isAvailable" = FALSE,
          "updatedAt" = NOW()
      `;
    }
  }
}
