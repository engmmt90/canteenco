import { prisma } from "@/lib/prisma";

export async function ensureProductOptionQuantityTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductOptionQuantitySetting" (
      "optionId" TEXT PRIMARY KEY,
      "quantityEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getProductOptionQuantitySettings() {
  await ensureProductOptionQuantityTable();

  const rows = await prisma.$queryRaw<
    Array<{
      optionId: string;
      quantityEnabled: boolean;
    }>
  >`
    SELECT "optionId", "quantityEnabled"
    FROM "ProductOptionQuantitySetting"
  `;

  return new Map(
    rows.map((row) => [
      row.optionId,
      row.quantityEnabled,
    ]),
  );
}

export async function setProductOptionQuantityEnabled(
  optionId: string,
  quantityEnabled: boolean,
) {
  await ensureProductOptionQuantityTable();

  await prisma.$executeRaw`
    INSERT INTO "ProductOptionQuantitySetting"
      ("optionId", "quantityEnabled", "updatedAt")
    VALUES
      (${optionId}, ${quantityEnabled}, NOW())
    ON CONFLICT ("optionId")
    DO UPDATE SET
      "quantityEnabled" = ${quantityEnabled},
      "updatedAt" = NOW()
  `;
}
