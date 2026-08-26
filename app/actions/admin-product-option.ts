"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function getString(
  formData: FormData,
  key: string,
) {
  return String(
    formData.get(key) ?? "",
  ).trim();
}

function getInteger(
  formData: FormData,
  key: string,
  fallback = 0,
) {
  const raw = getString(
    formData,
    key,
  );

  if (!raw) {
    return fallback;
  }

  const value =
    Number.parseInt(raw, 10);

  return Number.isFinite(value)
    ? value
    : fallback;
}

function getPrice(
  formData: FormData,
  key: string,
) {
  const raw = getString(
    formData,
    key,
  );

  const value = Number(raw);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      "Additional price must be a valid non-negative number.",
    );
  }

  return value.toFixed(2);
}

/*
 * ============================================================
 * SAVE OPTION GROUP
 * ============================================================
 */

export async function saveProductOptionGroup(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const productId =
    getString(
      formData,
      "productId",
    );

  const id =
    getString(
      formData,
      "id",
    );

  const name =
    getString(
      formData,
      "name",
    );

  const minSelections =
    getInteger(
      formData,
      "minSelections",
      0,
    );

  const maxSelections =
    getInteger(
      formData,
      "maxSelections",
      1,
    );

  const sortOrder =
    getInteger(
      formData,
      "sortOrder",
      0,
    );

  const isRequired =
    formData.get(
      "isRequired",
    ) === "on";

  const isActive =
    formData.get(
      "isActive",
    ) === "on";

  if (!productId) {
    throw new Error(
      "Product is required.",
    );
  }

  if (!name) {
    throw new Error(
      "Group name is required.",
    );
  }

  if (
    minSelections < 0
  ) {
    throw new Error(
      "Minimum selections cannot be negative.",
    );
  }

  if (
    maxSelections < 1
  ) {
    throw new Error(
      "Maximum selections must be at least 1.",
    );
  }

  if (
    minSelections >
    maxSelections
  ) {
    throw new Error(
      "Minimum selections cannot be greater than maximum selections.",
    );
  }

  const product =
    await prisma.product.findUnique({
      where: {
        id: productId,
      },

      select: {
        id: true,
      },
    });

  if (!product) {
    throw new Error(
      "Product not found.",
    );
  }

  if (id) {
    const existingGroup =
      await prisma.productOptionGroup.findFirst({
        where: {
          id,
          productId,
        },

        select: {
          id: true,
        },
      });

    if (!existingGroup) {
      throw new Error(
        "Option group not found.",
      );
    }

    await prisma.productOptionGroup.update({
      where: {
        id,
      },

      data: {
        name,
        minSelections,
        maxSelections,
        isRequired,
        isActive,
        sortOrder,
      },
    });
  } else {
    await prisma.productOptionGroup.create({
      data: {
        productId,
        name,
        minSelections,
        maxSelections,
        isRequired,
        isActive,
        sortOrder,
      },
    });
  }

  revalidatePath(
    `/admin/products/${productId}/options`,
  );

  revalidatePath(
    "/admin/products",
  );
}

/*
 * ============================================================
 * DELETE OPTION GROUP
 * ============================================================
 */

export async function deleteProductOptionGroup(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id =
    getString(
      formData,
      "id",
    );

  if (!id) {
    throw new Error(
      "Option group ID is required.",
    );
  }

  const group =
    await prisma.productOptionGroup.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        productId: true,
      },
    });

  if (!group) {
    throw new Error(
      "Option group not found.",
    );
  }

  await prisma.productOptionGroup.delete({
    where: {
      id,
    },
  });

  revalidatePath(
    `/admin/products/${group.productId}/options`,
  );

  revalidatePath(
    "/admin/products",
  );
}

/*
 * ============================================================
 * SAVE OPTION
 * ============================================================
 */

export async function saveProductOption(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const groupId =
    getString(
      formData,
      "groupId",
    );

  const id =
    getString(
      formData,
      "id",
    );

  const name =
    getString(
      formData,
      "name",
    );

  const additionalPrice =
    getPrice(
      formData,
      "additionalPrice",
    );

  const sortOrder =
    getInteger(
      formData,
      "sortOrder",
      0,
    );

  const isActive =
    formData.get(
      "isActive",
    ) === "on";

  if (!groupId) {
    throw new Error(
      "Option group is required.",
    );
  }

  if (!name) {
    throw new Error(
      "Option name is required.",
    );
  }

  const group =
    await prisma.productOptionGroup.findUnique({
      where: {
        id: groupId,
      },

      select: {
        id: true,
        productId: true,
      },
    });

  if (!group) {
    throw new Error(
      "Option group not found.",
    );
  }

  if (id) {
    const existingOption =
      await prisma.productOption.findFirst({
        where: {
          id,
          groupId,
        },

        select: {
          id: true,
        },
      });

    if (!existingOption) {
      throw new Error(
        "Option not found.",
      );
    }

    await prisma.productOption.update({
      where: {
        id,
      },

      data: {
        name,
        additionalPrice,
        sortOrder,
        isActive,
      },
    });
  } else {
    await prisma.productOption.create({
      data: {
        groupId,
        name,
        additionalPrice,
        sortOrder,
        isActive,
      },
    });
  }

  revalidatePath(
    `/admin/products/${group.productId}/options`,
  );

  revalidatePath(
    "/admin/products",
  );
}

/*
 * ============================================================
 * DELETE OPTION
 * ============================================================
 */

export async function deleteProductOption(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id =
    getString(
      formData,
      "id",
    );

  if (!id) {
    throw new Error(
      "Option ID is required.",
    );
  }

  const option =
    await prisma.productOption.findUnique({
      where: {
        id,
      },

      select: {
        id: true,

        group: {
          select: {
            productId: true,
          },
        },
      },
    });

  if (!option) {
    throw new Error(
      "Option not found.",
    );
  }

  await prisma.productOption.delete({
    where: {
      id,
    },
  });

  revalidatePath(
    `/admin/products/${option.group.productId}/options`,
  );

  revalidatePath(
    "/admin/products",
  );
}