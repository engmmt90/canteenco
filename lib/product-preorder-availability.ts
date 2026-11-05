import { prisma } from "@/lib/prisma";
import { ensureProductSchoolAvailabilityTable } from "@/lib/product-availability";

let tableReady: Promise<void> | null = null;

export async function ensureProductPreOrderAvailabilityTable() {
  if (!tableReady) {
    tableReady = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductPreOrderAvailability" (
        "productId" TEXT NOT NULL,
        "schoolId" TEXT NOT NULL,
        "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "ProductPreOrderAvailability_pkey" PRIMARY KEY ("productId", "schoolId")
      )
    `).then(() => undefined).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

export async function getBlockedPreOrderSchoolIdsByProduct() {
  await Promise.all([ensureProductSchoolAvailabilityTable(), ensureProductPreOrderAvailabilityTable()]);
  return prisma.$queryRaw<Array<{ productId: string; schoolId: string }>>`
    SELECT legacy."productId", legacy."schoolId"
    FROM "ProductSchoolAvailability" legacy
    LEFT JOIN "ProductPreOrderAvailability" override
      ON override."productId" = legacy."productId" AND override."schoolId" = legacy."schoolId"
    WHERE COALESCE(override."isAvailable", legacy."isAvailable") = FALSE
    UNION
    SELECT "productId", "schoolId" FROM "ProductPreOrderAvailability"
    WHERE "isAvailable" = FALSE
  `;
}

export async function setProductPreOrderAvailabilityForSchools(
  productId: string,
  managedSchoolIds: string[],
  availableSchoolIds: string[],
) {
  await ensureProductPreOrderAvailabilityTable();
  const available = new Set(availableSchoolIds);
  for (const schoolId of managedSchoolIds) {
    const isAvailable = available.has(schoolId);
    await prisma.$executeRaw`
      INSERT INTO "ProductPreOrderAvailability"
        ("productId", "schoolId", "isAvailable", "updatedAt")
      VALUES (${productId}, ${schoolId}, ${isAvailable}, NOW())
      ON CONFLICT ("productId", "schoolId") DO UPDATE SET
        "isAvailable" = ${isAvailable}, "updatedAt" = NOW()
    `;
  }
}
