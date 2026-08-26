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
  optionIds?: string[];
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

export async function findCashierStudents(
  query: string,
) {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(
      session.user.role as UserRole,
    )
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
          nfcCardNumber: {
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
    !STAFF_ROLES.includes(
      session.user.role as UserRole,
    )
  ) {
    throw new Error("Unauthorized");
  }

  const products =
    await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },

      include: {
        optionGroups: {
          where: {
            isActive: true,
          },

          orderBy: [
            {
              sortOrder: "asc",
            },

            {
              name: "asc",
            },
          ],

          include: {
            options: {
              where: {
                isActive: true,
              },

              orderBy: [
                {
                  sortOrder: "asc",
                },

                {
                  name: "asc",
                },
              ],
            },
          },
        },
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

  return products;
}

export async function createCashierSale(
  input: {
    studentId: string;
    items: CartLine[];
    idempotencyKey: string;
    adminPassword?: string;
  },
): Promise<CashierSaleResult> {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(
      session.user.role as UserRole,
    )
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  if (
    !input.idempotencyKey ||
    !input.items.length
  ) {
    return {
      ok: false,
      error: "Empty sale",
    };
  }

  const cleanItems =
    input.items.filter(
      (item) =>
        Number.isInteger(
          item.quantity,
        ) &&
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
        /*
         * ------------------------------------------------------------
         * IDEMPOTENCY
         * ------------------------------------------------------------
         */

        const existingSale =
          await tx.sale.findUnique({
            where: {
              idempotencyKey:
                input.idempotencyKey,
            },
          });

        if (existingSale) {
          return {
            ok: true,
            saleId: existingSale.id,
            saleNumber:
              existingSale.saleNumber,
            total:
              existingSale.total.toFixed(
                2,
              ),
            balanceAfter: "",
            overdraft:
              existingSale.isOverdraftOverride,
            duplicate: true,
          };
        }

        /*
         * ------------------------------------------------------------
         * STUDENT
         * ------------------------------------------------------------
         */

        const student =
          await tx.student.findUnique({
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
                  notificationPreference:
                    true,
                },
              },
            },
          });

        if (
          !student ||
          student.status !==
            StudentStatus.ACTIVE ||
          student.deletedAt
        ) {
          throw new Error(
            "Student is not active",
          );
        }

        /*
         * ------------------------------------------------------------
         * WALLET
         * ------------------------------------------------------------
         */

        const wallet =
          student.parent.wallet;

        if (
          !wallet ||
          wallet.status !==
            WalletStatus.ACTIVE
        ) {
          throw new Error(
            "Family wallet is not active",
          );
        }

        /*
         * ------------------------------------------------------------
         * PRODUCTS + OPTIONS
         * ------------------------------------------------------------
         */

        const uniqueProductIds = [
          ...new Set(
            cleanItems.map(
              (item) => item.productId,
            ),
          ),
        ];

        const products =
          await tx.product.findMany({
            where: {
              id: {
                in: uniqueProductIds,
              },

              isActive: true,
              deletedAt: null,
            },

            include: {
              optionGroups: {
                where: {
                  isActive: true,
                },

                orderBy: [
                  {
                    sortOrder: "asc",
                  },

                  {
                    name: "asc",
                  },
                ],

                include: {
                  options: {
                    where: {
                      isActive: true,
                    },

                    orderBy: [
                      {
                        sortOrder: "asc",
                      },

                      {
                        name: "asc",
                      },
                    ],
                  },
                },
              },
            },
          });

        if (
          products.length !==
          uniqueProductIds.length
        ) {
          throw new Error(
            "A product is unavailable",
          );
        }

        const productMap =
          new Map(
            products.map(
              (product) => [
                product.id,
                product,
              ],
            ),
          );

        /*
         * ------------------------------------------------------------
         * VALIDATE OPTIONS
         * ------------------------------------------------------------
         */

        const normalizedItems =
          cleanItems.map(
            (line) => {
              const product =
                productMap.get(
                  line.productId,
                );

              if (!product) {
                throw new Error(
                  "A product is unavailable",
                );
              }

              const requestedOptionIds =
                [
                  ...new Set(
                    (
                      line.optionIds ??
                      []
                    ).filter(
                      Boolean,
                    ),
                  ),
                ];

              const allOptions =
                product.optionGroups.flatMap(
                  (group) =>
                    group.options,
                );

              const selectedOptions =
                allOptions.filter(
                  (option) =>
                    requestedOptionIds.includes(
                      option.id,
                    ),
                );

              /*
               * Prevent selecting an option
               * belonging to another product.
               */

              if (
                selectedOptions.length !==
                requestedOptionIds.length
              ) {
                throw new Error(
                  `Invalid options selected for ${product.name}`,
                );
              }

              /*
               * Validate every group.
               */

              for (const group of
                product.optionGroups) {
                const groupOptionIds =
                  group.options.map(
                    (option) =>
                      option.id,
                  );

                const selectedInGroup =
                  selectedOptions.filter(
                    (option) =>
                      groupOptionIds.includes(
                        option.id,
                      ),
                  );

                const count =
                  selectedInGroup.length;

                const minimum =
                  Math.max(
                    group.minSelections,
                    group.isRequired
                      ? 1
                      : 0,
                  );

                if (
                  count < minimum
                ) {
                  throw new Error(
                    `${group.name} requires at least ${minimum} selection${
                      minimum === 1
                        ? ""
                        : "s"
                    } for ${product.name}`,
                  );
                }

                if (
                  group.maxSelections >
                    0 &&
                  count >
                    group.maxSelections
                ) {
                  throw new Error(
                    `${group.name} allows a maximum of ${group.maxSelections} selections for ${product.name}`,
                  );
                }
              }

              /*
               * Calculate option surcharge
               * from the database.
               */

              const optionsTotal =
                selectedOptions.reduce(
                  (
                    sum,
                    option,
                  ) =>
                    sum.add(
                      option.additionalPrice,
                    ),

                  new Prisma.Decimal(
                    0,
                  ),
                );

              const unitPrice =
                product.price.add(
                  optionsTotal,
                );

              const lineTotal =
                unitPrice.mul(
                  line.quantity,
                );

              return {
                product,
                quantity:
                  line.quantity,
                selectedOptions,
                unitPrice,
                lineTotal,
              };
            },
          );

        /*
         * ------------------------------------------------------------
         * TOTAL
         * ------------------------------------------------------------
         */

        let total =
          new Prisma.Decimal(0);

        for (const line of
          normalizedItems) {
          total = total.add(
            line.lineTotal,
          );
        }

        /*
         * ------------------------------------------------------------
         * DAILY SPENDING LIMIT
         * ------------------------------------------------------------
         */

        if (
          student.dailySpendLimit !==
          null
        ) {
          const now =
            new Date();

          const startOfToday =
            new Date(now);

          startOfToday.setHours(
            0,
            0,
            0,
            0,
          );

          const startOfTomorrow =
            new Date(
              startOfToday,
            );

          startOfTomorrow.setDate(
            startOfTomorrow.getDate() +
              1,
          );

          const [
            salesToday,
            preOrdersToday,
          ] =
            await Promise.all([
              tx.sale.aggregate({
                where: {
                  studentId:
                    student.id,

                  createdAt: {
                    gte: startOfToday,
                    lt: startOfTomorrow,
                  },

                  status:
                    "COMPLETED",
                },

                _sum: {
                  total: true,
                },
              }),

              tx.preOrder.aggregate({
                where: {
                  studentId:
                    student.id,

                  createdAt: {
                    gte: startOfToday,
                    lt: startOfTomorrow,
                  },

                  status: {
                    in: [
                      "CONFIRMED",
                      "PREPARING",
                      "READY",
                      "PICKED_UP",
                    ],
                  },
                },

                _sum: {
                  total: true,
                },
              }),
            ]);

          const salesSpent =
            new Prisma.Decimal(
              salesToday._sum
                .total ?? 0,
            );

          const preOrdersSpent =
            new Prisma.Decimal(
              preOrdersToday
                ._sum.total ?? 0,
            );

          const spentToday =
            salesSpent.add(
              preOrdersSpent,
            );

          const projectedSpent =
            spentToday.add(
              total,
            );

          if (
            projectedSpent.gt(
              student.dailySpendLimit,
            )
          ) {
            const remaining =
              Prisma.Decimal.max(
                student.dailySpendLimit.sub(
                  spentToday,
                ),
                new Prisma.Decimal(
                  0,
                ),
              );

            return {
              ok: false,
              error:
                remaining.gt(0)
                  ? `Daily spending limit exceeded. This student has $${remaining.toFixed(
                      2,
                    )} remaining today.`
                  : "Daily spending limit reached. No more spending is allowed today.",
            };
          }
        }

        /*
         * ------------------------------------------------------------
         * BALANCE
         * ------------------------------------------------------------
         */

        const proposedBalance =
          wallet.balance.sub(
            total,
          );

        let approverId:
          | string
          | undefined;

        /*
         * ------------------------------------------------------------
         * ADMIN OVERRIDE
         * ------------------------------------------------------------
         */

        if (
          proposedBalance.lt(0)
        ) {
          if (
            !input.adminPassword
          ) {
            return {
              ok: false,
              error:
                "Insufficient balance",
              needsAdminOverride:
                true,
            };
          }

          const admins =
            await tx.user.findMany({
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

                    schoolId:
                      student.schoolId,
                  },
                ],
              },
            });

          let approvedAdmin:
            | (typeof admins)[number]
            | null = null;

          for (const admin of
            admins) {
            const passwordMatches =
              await bcrypt.compare(
                input.adminPassword,
                admin.passwordHash,
              );

            if (
              passwordMatches
            ) {
              approvedAdmin =
                admin;

              break;
            }
          }

          if (!approvedAdmin) {
            return {
              ok: false,
              error:
                "Invalid admin password",
              needsAdminOverride:
                true,
            };
          }

          approverId =
            approvedAdmin.id;
        }

        /*
         * ------------------------------------------------------------
         * GUARDED WALLET UPDATE
         * ------------------------------------------------------------
         */

        const guardedWalletUpdate =
          await tx.wallet.updateMany({
            where: {
              id: wallet.id,
              balance:
                wallet.balance,
            },

            data: {
              balance:
                proposedBalance,
            },
          });

        if (
          guardedWalletUpdate.count !==
          1
        ) {
          throw new Error(
            "Wallet balance changed. Please retry the sale.",
          );
        }

        /*
         * ------------------------------------------------------------
         * CREATE SALE
         * ------------------------------------------------------------
         */

        const sale =
          await tx.sale.create({
            data: {
              saleNumber:
                `SALE-${Date.now()}-${randomUUID()
                  .slice(0, 6)
                  .toUpperCase()}`,

              idempotencyKey:
                input.idempotencyKey,

              schoolId:
                student.schoolId,

              studentId:
                student.id,

              walletId:
                wallet.id,

              cashierUserId:
                session.user.id,

              subtotal: total,

              total,

              isOverdraftOverride:
                proposedBalance.lt(
                  0,
                ),

              overrideApprovedById:
                approverId,

              items: {
                create:
                  normalizedItems.map(
                    (line) => ({
                      productId:
                        line.product.id,

                      productNameSnapshot:
                        line.product
                          .name,

                      quantity:
                        line.quantity,

                      unitPrice:
                        line.unitPrice,

                      lineTotal:
                        line.lineTotal,

                      options: {
                        create:
                          line.selectedOptions.map(
                            (option) => ({
                              productOptionId:
                                option.id,

                              optionName:
                                option.name,

                              additionalPrice:
                                option.additionalPrice,

                              quantity: 1,
                            }),
                          ),
                      },
                    }),
                  ),
              },
            },
          });

        /*
         * ------------------------------------------------------------
         * WALLET TRANSACTION
         * ------------------------------------------------------------
         */

        await tx.walletTransaction.create(
          {
            data: {
              walletId:
                wallet.id,

              studentId:
                student.id,

              type: proposedBalance.lt(
                0,
              )
                ? WalletTransactionType.OVERDRAFT_SALE
                : WalletTransactionType.SALE_DEBIT,

              amount:
                total.neg(),

              balanceAfter:
                proposedBalance,

              description:
                `Canteen sale ${sale.saleNumber}`,

              saleId: sale.id,
            },
          },
        );

        /*
         * ------------------------------------------------------------
         * PURCHASE NOTIFICATION
         * ------------------------------------------------------------
         */

        await queueParentNotification({
          tx,

          userId:
            student.parent.user.id,

          parentId:
            student.parent.id,

          event:
            NotificationEvent.PURCHASE_COMPLETED,

          preferenceKey:
            "notifyPurchase",

          subject:
            "Canteen purchase completed",

          message: `${student.firstName} ${
            student.lastName
          } purchased $${total.toFixed(
            2,
          )} from CanteenCo. Family wallet balance: $${proposedBalance.toFixed(
            2,
          )}.`,

          metadata: {
            saleId:
              sale.id,

            studentId:
              student.id,

            amount:
              Number(total),

            balanceAfter:
              Number(
                proposedBalance,
              ),
          },

          schoolId:
            student.schoolId,
        });

        /*
         * ------------------------------------------------------------
         * LOW BALANCE NOTIFICATION
         * ------------------------------------------------------------
         */

        const lowBalanceThreshold =
          student.parent
            .notificationPreference
            ?.lowBalanceThreshold;

        if (
          student.parent
            .notificationPreference
            ?.notifyLowBalance &&
          lowBalanceThreshold !==
            null &&
          lowBalanceThreshold !==
            undefined &&
          proposedBalance.lte(
            lowBalanceThreshold,
          )
        ) {
          await queueParentNotification({
            tx,

            userId:
              student.parent.user.id,

            parentId:
              student.parent.id,

            event:
              NotificationEvent.LOW_BALANCE,

            preferenceKey:
              "notifyLowBalance",

            subject:
              "Family wallet balance is low",

            message: `Your CanteenCo family wallet balance is $${proposedBalance.toFixed(
              2,
            )}, which is at or below your alert level of $${lowBalanceThreshold.toFixed(
              2,
            )}.`,

            metadata: {
              walletId:
                wallet.id,

              balance:
                Number(
                  proposedBalance,
                ),

              threshold:
                Number(
                  lowBalanceThreshold,
                ),
            },

            schoolId:
              student.schoolId,
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

          saleNumber:
            sale.saleNumber,

          total:
            total.toFixed(2),

          balanceAfter:
            proposedBalance.toFixed(
              2,
            ),

          overdraft:
            proposedBalance.lt(
              0,
            ),
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