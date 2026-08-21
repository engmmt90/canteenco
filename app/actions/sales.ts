"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { queueParentNotification } from "@/lib/notifications";

import {
  NotificationEvent,
  Prisma,
  StudentStatus,
  UserRole,
  UserStatus,
  WalletStatus,
  WalletTransactionType,
} from "@/generated/prisma/client";

const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.CASHIER,
];

type CartLine = {
  productId: string;
  quantity: number;
};

type CashierSaleResult =
  | {
      ok: true;
      saleId: string;
      saleNumber: string;
      total: string;
      balanceAfter: string;
      overdraft: boolean;
      duplicate?: boolean;
    }
  | {
      ok: false;
      error: string;
      needsAdminOverride?: boolean;
    };

export async function findCashierStudents(query: string) {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(session.user.role as UserRole)
  ) {
    throw new Error("Unauthorized");
  }

  const q = query.trim();

  if (!q) {
    return [];
  }

  return prisma.student.findMany({
    where: {
      deletedAt: null,
      status: StudentStatus.ACTIVE,

      OR: [
        {
          displayCode: {
            equals: q,
            mode: "insensitive",
          },
        },
        {
          qrToken: q,
        },
        {
          firstName: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    },

    include: {
      parent: {
        include: {
          wallet: true,
        },
      },
    },

    take: 10,

    orderBy: [
      {
        firstName: "asc",
      },
      {
        lastName: "asc",
      },
    ],
  });
}

export async function getCashierProducts() {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(session.user.role as UserRole)
  ) {
    throw new Error("Unauthorized");
  }

  return prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },

    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function createCashierSale(input: {
  studentId: string;
  items: CartLine[];
  idempotencyKey: string;
  adminPassword?: string;
}): Promise<CashierSaleResult> {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(session.user.role as UserRole)
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  if (!input.idempotencyKey || !input.items.length) {
    return {
      ok: false,
      error: "Empty sale",
    };
  }

  const cleanItems = input.items.filter(
    (item) =>
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      Boolean(item.productId),
  );

  if (!cleanItems.length) {
    return {
      ok: false,
      error: "Empty sale",
    };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const existingSale = await tx.sale.findUnique({
          where: {
            idempotencyKey: input.idempotencyKey,
          },
        });

        if (existingSale) {
          return {
            ok: true,
            saleId: existingSale.id,
            saleNumber: existingSale.saleNumber,
            total: existingSale.total.toFixed(2),
            balanceAfter: "",
            overdraft: existingSale.isOverdraftOverride,
            duplicate: true,
          };
        }

        const student = await tx.student.findUnique({
          where: {
            id: input.studentId,
          },

          include: {
            school: {
              include: {
                settings: true,
              },
            },

            parent: {
              include: {
                wallet: true,
                user: true,
                notificationPreference: true,
              },
            },
          },
        });

        if (
          !student ||
          student.status !== StudentStatus.ACTIVE ||
          student.deletedAt
        ) {
          throw new Error("Student is not active");
        }

        const wallet = student.parent.wallet;

        if (!wallet || wallet.status !== WalletStatus.ACTIVE) {
          throw new Error("Family wallet is not active");
        }

        const uniqueProductIds = [
          ...new Set(cleanItems.map((item) => item.productId)),
        ];

        const products = await tx.product.findMany({
          where: {
            id: {
              in: uniqueProductIds,
            },
            isActive: true,
            deletedAt: null,
          },
        });

        if (products.length !== uniqueProductIds.length) {
          throw new Error("A product is unavailable");
        }

        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        let total = new Prisma.Decimal(0);

        for (const line of cleanItems) {
          const product = productMap.get(line.productId);

          if (!product) {
            throw new Error("A product is unavailable");
          }

          total = total.add(product.price.mul(line.quantity));
        }

        const proposedBalance = wallet.balance.sub(total);
        const settings = student.school.settings;

        let approverId: string | undefined;

        /*
         * ------------------------------------------------------------
         * NEGATIVE BALANCE / ADMIN APPROVAL
         * ------------------------------------------------------------
         *
         * If the sale would make the wallet negative:
         *
         * 1. Without admin password:
         *      Return needsAdminOverride = true.
         *
         * 2. With admin password:
         *      Validate an active SUPER_ADMIN or SCHOOL_ADMIN.
         *
         * 3. If valid:
         *      Allow the negative sale.
         *
         * Admin approval intentionally overrides:
         *
         *   - allowNegativeBalance
         *   - minimumAllowedBalance
         *
         * This means the cashier can ask an admin to approve
         * a sale even when the normal school policy does not
         * allow negative balances.
         */

        if (proposedBalance.lt(0)) {
          /*
           * No admin password yet.
           *
           * Do NOT throw "Insufficient balance".
           *
           * Return a structured response so the cashier UI
           * can open the popup.
           */
          if (!input.adminPassword) {
            return {
              ok: false,
              error: "Insufficient balance",
              needsAdminOverride: true,
            };
          }

          /*
           * Admin password was supplied.
           *
           * Find active SUPER_ADMIN or SCHOOL_ADMIN users.
           *
           * SUPER_ADMIN can approve any school.
           * SCHOOL_ADMIN can approve sales for their own school.
           */
          const admins = await tx.user.findMany({
            where: {
              status: UserStatus.ACTIVE,
              deletedAt: null,

              role: {
                in: [
                  UserRole.SUPER_ADMIN,
                  UserRole.SCHOOL_ADMIN,
                ],
              },

              OR: [
                {
                  role: UserRole.SUPER_ADMIN,
                },
                {
                  role: UserRole.SCHOOL_ADMIN,
                  schoolId: student.schoolId,
                },
              ],
            },
          });

          let approvedAdmin:
            | (typeof admins)[number]
            | null = null;

          for (const admin of admins) {
            const passwordMatches = await bcrypt.compare(
              input.adminPassword,
              admin.passwordHash,
            );

            if (passwordMatches) {
              approvedAdmin = admin;
              break;
            }
          }

          if (!approvedAdmin) {
            return {
              ok: false,
              error: "Invalid admin password",
              needsAdminOverride: true,
            };
          }

          /*
           * Admin successfully approved the negative sale.
           */
          approverId = approvedAdmin.id;
        }

        /*
         * ------------------------------------------------------------
         * GUARDED WALLET UPDATE
         * ------------------------------------------------------------
         *
         * Prevent two simultaneous purchases from spending
         * the same wallet balance.
         */

        const guardedWalletUpdate = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            balance: wallet.balance,
          },

          data: {
            balance: proposedBalance,
          },
        });

        if (guardedWalletUpdate.count !== 1) {
          throw new Error(
            "Wallet balance changed. Please retry the sale.",
          );
        }

        /*
         * ------------------------------------------------------------
         * CREATE SALE
         * ------------------------------------------------------------
         */

        const sale = await tx.sale.create({
          data: {
            saleNumber: `SALE-${Date.now()}-${randomUUID()
              .slice(0, 6)
              .toUpperCase()}`,

            idempotencyKey: input.idempotencyKey,

            schoolId: student.schoolId,
            studentId: student.id,
            walletId: wallet.id,
            cashierUserId: session.user.id,

            subtotal: total,
            total,

            /*
             * Any negative approved sale is recorded as
             * an overdraft override.
             */
            isOverdraftOverride: proposedBalance.lt(0),

            overrideApprovedById: approverId,

            items: {
              create: cleanItems.map((line) => {
                const product = productMap.get(line.productId);

                if (!product) {
                  throw new Error("A product is unavailable");
                }

                return {
                  productId: product.id,
                  productNameSnapshot: product.name,
                  unitPrice: product.price,
                  quantity: line.quantity,
                  lineTotal: product.price.mul(line.quantity),
                };
              }),
            },
          },
        });

        /*
         * ------------------------------------------------------------
         * WALLET TRANSACTION
         * ------------------------------------------------------------
         */

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            studentId: student.id,

            type: proposedBalance.lt(0)
              ? WalletTransactionType.OVERDRAFT_SALE
              : WalletTransactionType.SALE_DEBIT,

            amount: total.neg(),
            balanceAfter: proposedBalance,

            description: `Canteen sale ${sale.saleNumber}`,

            saleId: sale.id,
          },
        });

        /*
         * ------------------------------------------------------------
         * PARENT PURCHASE NOTIFICATION
         * ------------------------------------------------------------
         */

        await queueParentNotification({
          tx,

          userId: student.parent.user.id,
          parentId: student.parent.id,

          event: NotificationEvent.PURCHASE_COMPLETED,

          preferenceKey: "notifyPurchase",

          subject: "Canteen purchase completed",

          message: `${student.firstName} ${
            student.lastName
          } purchased $${total.toFixed(
            2,
          )} from CanteenCo. Family wallet balance: $${proposedBalance.toFixed(
            2,
          )}.`,

          metadata: {
            saleId: sale.id,
            studentId: student.id,
            amount: Number(total),
            balanceAfter: Number(proposedBalance),
          },

          schoolId: student.schoolId,
        });

        /*
         * ------------------------------------------------------------
         * LOW BALANCE NOTIFICATION
         * ------------------------------------------------------------
         */

        const lowBalanceThreshold =
          student.parent.notificationPreference
            ?.lowBalanceThreshold;

        if (
          student.parent.notificationPreference
            ?.notifyLowBalance &&
          lowBalanceThreshold !== null &&
          lowBalanceThreshold !== undefined &&
          proposedBalance.lte(lowBalanceThreshold)
        ) {
          await queueParentNotification({
            tx,

            userId: student.parent.user.id,
            parentId: student.parent.id,

            event: NotificationEvent.LOW_BALANCE,

            preferenceKey: "notifyLowBalance",

            subject: "Family wallet balance is low",

            message: `Your CanteenCo family wallet balance is $${proposedBalance.toFixed(
              2,
            )}, which is at or below your alert level of $${lowBalanceThreshold.toFixed(
              2,
            )}.`,

            metadata: {
              walletId: wallet.id,
              balance: Number(proposedBalance),
              threshold: Number(lowBalanceThreshold),
            },

            schoolId: student.schoolId,
          });
        }

        /*
         * ------------------------------------------------------------
         * SUCCESS
         * ------------------------------------------------------------
         */

        return {
          ok: true,
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          total: total.toFixed(2),
          balanceAfter: proposedBalance.toFixed(2),
          overdraft: proposedBalance.lt(0),
        };
      },

      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    return {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : "Sale failed",
    };
  }
}