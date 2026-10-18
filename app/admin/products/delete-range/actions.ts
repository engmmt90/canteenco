"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const MIN_SORT = 80;
const MAX_SORT = 370;

export async function deleteProductsInSortRange(formData: FormData) {
  const session = await requireAdmin();

  if (session.user.role !== "SUPER_ADMIN") {
    throw new Error("Super Admin only");
  }

  const confirmation = String(
    formData.get("confirmation") ?? "",
  ).trim();

  if (confirmation !== "DELETE 80-370") {
    throw new Error('Type DELETE 80-370 exactly to continue.');
  }

  await prisma.product.updateMany({
    where: {
      deletedAt: null,
      sortOrder: {
        gte: MIN_SORT,
        lte: MAX_SORT,
      },
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/cashier");
  revalidatePath("/parent/preorders");
  redirect("/admin/products/delete-range?done=1");
}
