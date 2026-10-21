"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ensureProductSchoolAvailabilityTable,
  getBlockedProductIds,
} from "@/lib/product-availability";
import {
  ensureProductOptionSchoolAvailabilityTable,
  getBlockedProductOptionIds,
} from "@/lib/product-option-availability";
import {
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";

const ALLOWED_STAFF_ROLES: UserRole[] = [
  UserRole.CASHIER,
  UserRole.SCHOOL_ADMIN,
  UserRole.SUPER_ADMIN,
];

async function getStockSession() {
  const session = await auth();

  if (
    !session?.user?.id ||
    !ALLOWED_STAFF_ROLES.includes(
      session.user.role as UserRole,
    ) ||
    !session.user.schoolId
  ) {
    throw new Error("Unauthorized");
  }

  return {
    session,
    schoolId: session.user.schoolId,
  };
}

export async function getCashierStockData() {
  const { schoolId } =
    await getStockSession();

  await Promise.all([
    ensureProductSchoolAvailabilityTable(),
    ensureProductOptionSchoolAvailabilityTable(),
  ]);

  const [
    school,
    products,
    blockedProductIds,
    blockedOptionIds,
  ] = await Promise.all([
    prisma.school.findFirst({
      where: {
        id: schoolId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        name: true,
        category: true,
        imageUrl: true,
        optionGroups: {
          where: {
            isActive: true,
          },
          orderBy: [
            { sortOrder: "asc" },
            { name: "asc" },
          ],
          select: {
            id: true,
            name: true,
            options: {
              where: {
                isActive: true,
              },
              orderBy: [
                { sortOrder: "asc" },
                { name: "asc" },
              ],
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    getBlockedProductIds(schoolId),
    getBlockedProductOptionIds(schoolId),
  ]);

  if (!school) {
    throw new Error(
      "School is not active or available.",
    );
  }

  return {
    school,
    products: products.map(
      (product) => ({
        ...product,
        isAvailable:
          !blockedProductIds.has(
            product.id,
          ),
        optionGroups:
          product.optionGroups.map(
            (group) => ({
              ...group,
              options:
                group.options.map(
                  (option) => ({
                    ...option,
                    isAvailable:
                      !blockedOptionIds.has(
                        option.id,
                      ),
                  }),
                ),
            }),
          ),
      }),
    ),
  };
}

type StockChange = {
  id: string;
  isAvailable: boolean;
};

export async function saveCashierStockChanges(
  input: {
    adminPassword: string;
    productChanges: StockChange[];
    optionChanges: StockChange[];
  },
): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  try {
    const { session, schoolId } =
      await getStockSession();

    const password =
      input.adminPassword?.trim();

    if (!password) {
      return {
        ok: false,
        error:
          "Admin password is required.",
      };
    }

    await Promise.all([
      ensureProductSchoolAvailabilityTable(),
      ensureProductOptionSchoolAvailabilityTable(),
    ]);

    const admins =
      await prisma.user.findMany({
        where: {
          status:
            UserStatus.ACTIVE,
          deletedAt: null,
          role: {
            in: [
              UserRole.SUPER_ADMIN,
              UserRole.SCHOOL_ADMIN,
            ],
          },
          OR: [
            {
              role:
                UserRole.SUPER_ADMIN,
            },
            {
              role:
                UserRole.SCHOOL_ADMIN,
              schoolId,
            },
          ],
        },
        select: {
          id: true,
          passwordHash: true,
        },
      });

    let approvedByAdminId:
      | string
      | null = null;

    for (const admin of admins) {
      if (
        await bcrypt.compare(
          password,
          admin.passwordHash,
        )
      ) {
        approvedByAdminId =
          admin.id;
        break;
      }
    }

    if (!approvedByAdminId) {
      return {
        ok: false,
        error:
          "Invalid admin password.",
      };
    }

    const productChanges = [
      ...new Map(
        (input.productChanges ?? []).map(
          (item) => [
            item.id,
            item,
          ],
        ),
      ).values(),
    ].filter(
      (item) =>
        Boolean(item.id) &&
        typeof item.isAvailable ===
          "boolean",
    );

    const optionChanges = [
      ...new Map(
        (input.optionChanges ?? []).map(
          (item) => [
            item.id,
            item,
          ],
        ),
      ).values(),
    ].filter(
      (item) =>
        Boolean(item.id) &&
        typeof item.isAvailable ===
          "boolean",
    );

    if (
      productChanges.length === 0 &&
      optionChanges.length === 0
    ) {
      return { ok: true };
    }

    const [
      validProducts,
      validOptions,
    ] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: {
            in: productChanges.map(
              (item) => item.id,
            ),
          },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.productOption.findMany({
        where: {
          id: {
            in: optionChanges.map(
              (item) => item.id,
            ),
          },
          isActive: true,
          group: {
            isActive: true,
            product: {
              isActive: true,
              deletedAt: null,
            },
          },
        },
        select: { id: true },
      }),
    ]);

    if (
      validProducts.length !==
        productChanges.length ||
      validOptions.length !==
        optionChanges.length
    ) {
      return {
        ok: false,
        error:
          "One or more stock items are no longer available. Refresh and try again.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
        for (const change of
          productChanges) {
          if (change.isAvailable) {
            await tx.$executeRaw`
              DELETE FROM "ProductSchoolAvailability"
              WHERE "productId" = ${change.id}
                AND "schoolId" = ${schoolId}
            `;
          } else {
            await tx.$executeRaw`
              INSERT INTO "ProductSchoolAvailability"
                ("productId", "schoolId", "isAvailable", "updatedAt")
              VALUES
                (${change.id}, ${schoolId}, FALSE, NOW())
              ON CONFLICT ("productId", "schoolId")
              DO UPDATE SET
                "isAvailable" = FALSE,
                "updatedAt" = NOW()
            `;
          }
        }

        for (const change of
          optionChanges) {
          if (change.isAvailable) {
            await tx.$executeRaw`
              DELETE FROM "ProductOptionSchoolAvailability"
              WHERE "optionId" = ${change.id}
                AND "schoolId" = ${schoolId}
            `;
          } else {
            await tx.$executeRaw`
              INSERT INTO "ProductOptionSchoolAvailability"
                ("optionId", "schoolId", "isAvailable", "updatedAt")
              VALUES
                (${change.id}, ${schoolId}, FALSE, NOW())
              ON CONFLICT ("optionId", "schoolId")
              DO UPDATE SET
                "isAvailable" = FALSE,
                "updatedAt" = NOW()
            `;
          }
        }

        await tx.auditLog.create({
          data: {
            actorUserId:
              session.user.id,
            action:
              "CASHIER_STOCK_UPDATE",
            entityType:
              "SchoolStock",
            entityId:
              schoolId,
            metadata: {
              approvedByAdminId,
              schoolId,
              productChanges,
              optionChanges,
            },
          },
        });
      },
    );

    revalidatePath("/cashier");
    revalidatePath(
      "/parent/preorders",
    );

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not update stock.",
    };
  }
}
