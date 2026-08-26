"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function int(
  formData: FormData,
  key: string,
  fallback = 0,
) {
  const value = Number.parseInt(
    str(formData, key),
    10,
  );

  return Number.isFinite(value)
    ? value
    : fallback;
}

function decimal(
  formData: FormData,
  key: string,
) {
  const value = Number(
    str(formData, key),
  );

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${key} must be a valid non-negative number.`,
    );
  }

  return value.toFixed(2);
}

export async function saveProductOptionGroup(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const productId = str(
    formData,
    "productId",
  );

  const id = str(formData, "id");
  const name = str(formData, "name");

  const minSelections = int(
    formData,
    "minSelections",
    0,
  );

  const maxSelections = int(
    formData,
    "maxSelections",
    1,
  );

  const sortOrder = int(
    formData,
    "sortOrder",
    0,
  );

  const isRequired =
    formData.get("isRequired") === "on";

  const isActive =
    formData.get("isActive") !== "off";

  if (!productId) {
    throw new Error(
      "Product is required.",
    );
  }

  if (!name) {
    throw new Error(
      "Option group name is required.",
    );
  }

  if (
    minSelections < 0 ||
    maxSelections < 1 ||
    minSelections > maxSelections
  ) {
    throw new Error(
      "Invalid minimum or maximum selections.",
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
    const group =
      await prisma.productOptionGroup.findUnique(
        {
          where: {
            id,
          },
          select: {
            id: true,
            productId: true,
          },
        },
      );

    if (
      !group ||
      group.productId !== productId
    ) {
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

export async function deleteProductOptionGroup(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = str(formData, "id");

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

export async function saveProductOption(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const groupId = str(
    formData,
    "groupId",
  );

  const id = str(formData, "id");
  const name = str(formData, "name");

  const additionalPrice = decimal(
    formData,
    "additionalPrice",
  );

  const sortOrder = int(
    formData,
    "sortOrder",
    0,
  );

  const isActive =
    formData.get("isActive") !== "off";

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
    const option =
      await prisma.productOption.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          groupId: true,
        },
      });

    if (
      !option ||
      option.groupId !== groupId
    ) {
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
}

export async function deleteProductOption(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const id = str(formData, "id");

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
        groupId: true,
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
}