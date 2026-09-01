"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function saveProductOrder(productIds: string[]) {
  await requireAdmin();

  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];

  if (ids.length === 0) {
    throw new Error("No products were supplied.");
  }

  const existing = await prisma.product.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    throw new Error("One or more products could not be found.");
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.product.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      }),
    ),
  );

  revalidatePath("/admin/products");
  revalidatePath("/cashier");

  return { ok: true };
}
