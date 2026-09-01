"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function saveProductOrder(
  productIds: string[],
) {
  await requireAdmin();

  const ids = [
    ...new Set(
      productIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (ids.length === 0) {
    throw new Error(
      "No products were supplied.",
    );
  }

  const existing =
    await prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

  if (
    existing.length !== ids.length
  ) {
    throw new Error(
      "One or more products could not be found.",
    );
  }

  /*
   * Neon can take a little longer when many
   * products are updated. Use an interactive
   * transaction with a larger timeout instead
   * of Prisma's default 5 seconds.
   */
  await prisma.$transaction(
    async (tx) => {
      for (
        let index = 0;
        index < ids.length;
        index++
      ) {
        await tx.product.update({
          where: {
            id: ids[index],
          },
          data: {
            sortOrder:
              (index + 1) * 10,
          },
        });
      }
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  revalidatePath(
    "/admin/products",
  );
  revalidatePath("/cashier");

  return {
    ok: true,
  };
}