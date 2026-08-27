"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { queueParentNotification } from "@/lib/notifications";

import {
  NotificationEvent,
  PreOrderStatus,
  Prisma,
  StudentStatus,
  UserRole,
  WalletStatus,
  WalletTransactionType,
} from "@/generated/prisma/client";

const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.CASHIER,
];

type PreOrderOptionInput = {
  groupId: string;
  optionId: string;
};

type PreOrderLine = {
  productId: string;
  quantity: number;

  /*
   * New format used by preorder-form.tsx
   */
  options?: PreOrderOptionInput[];

  /*
   * Also accept optionIds for compatibility
   * with older versions of the form.
   */
  optionIds?: string[];
};

type CreatePreOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: string;
      balanceAfter: string;
      duplicate?: boolean;
    }
  | {
      ok: false;
      error: string;
    };

type UpdatePreOrderStatusResult =
  | {
      ok: true;
      status: PreOrderStatus;
    }
  | {
      ok: false;
      error: string;
    };

type CancelPreOrderResult =
  | {
      ok: true;
      balanceAfter: string;
    }
  | {
      ok: false;
      error: string;
    };

/* ============================================================
 * HELPERS
 * ============================================================ */

function getLocalDateTime(
  timeZone: string,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    ).formatToParts(new Date());

  const get = (type: string) =>
    parts.find(
      (part) =>
        part.type === type,
    )?.value ?? "";

  return {
    date: `${get("year")}-${get(
      "month",
    )}-${get("day")}`,

    time: `${get("hour")}:${get(
      "minute",
    )}`,
  };
}

/* ============================================================
 * PARENT PRE-ORDER DATA
 * ============================================================ */

export async function getParentPreOrderData() {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.role !==
      UserRole.PARENT
  ) {
    throw new Error(
      "Unauthorized",
    );
  }

  const parent =
    await prisma.parentProfile.findUnique(
      {
        where: {
          userId: session.user.id,
        },

        include: {
          wallet: true,

          students: {
            where: {
              status:
                StudentStatus.ACTIVE,

              deletedAt: null,
            },

            include: {
              school: {
                include: {
                  settings: true,

                  pickupSlots: {
                    where: {
                      isActive: true,
                    },

                    orderBy: {
                      sortOrder: "asc",
                    },
                  },
                },
              },
            },

            orderBy: [
              {
                firstName: "asc",
              },
              {
                lastName: "asc",
              },
            ],
          },
        },
      },
    );

  /*
   * IMPORTANT:
   *
   * Product
   *   └── optionGroups
   *          └── options
   *
   * This is what allows the parent UI
   * to display:
   *
   * Sauce
   *   ├── Sauce 1
   *   ├── Sauce 2
   *   └── Sauce 3
   */

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

  return {
    parent,
    products,
  };
}

/* ============================================================
 * CREATE PARENT PRE-ORDER
 * ============================================================ */

export async function createParentPreOrder(
  input: {
    studentId: string;
    pickupSlotId: string;
    pickupDate: string;
    items: PreOrderLine[];
    idempotencyKey: string;
  },
): Promise<CreatePreOrderResult> {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.role !==
      UserRole.PARENT
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  if (
    !input.studentId ||
    !input.pickupSlotId ||
    !input.pickupDate ||
    !input.idempotencyKey ||
    !input.items.length
  ) {
    return {
      ok: false,
      error: "Incomplete order",
    };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        /*
         * ------------------------------------------------------
         * IDEMPOTENCY
         * ------------------------------------------------------
         */

        const existing =
          await tx.preOrder.findUnique(
            {
              where: {
                idempotencyKey:
                  input.idempotencyKey,
              },
            },
          );

        if (existing) {
          const transaction =
            await tx.walletTransaction.findUnique(
              {
                where: {
                  preOrderId:
                    existing.id,
                },
              },
            );

          return {
            ok: true,
            orderId: existing.id,
            orderNumber:
              existing.orderNumber,
            total:
              existing.total.toFixed(
                2,
              ),
            balanceAfter:
              transaction?.balanceAfter.toFixed(
                2,
              ) ?? "",
            duplicate: true,
          };
        }

        /*
         * ------------------------------------------------------
         * PARENT
         * ------------------------------------------------------
         */

        const parent =
          await tx.parentProfile.findUnique(
            {
              where: {
                userId:
                  session.user.id,
              },

              include: {
                wallet: true,
              },
            },
          );

        if (
          !parent?.wallet ||
          parent.wallet.status !==
            WalletStatus.ACTIVE
        ) {
          throw new Error(
            "Family wallet is not active",
          );
        }

        /*
         * ------------------------------------------------------
         * STUDENT
         * ------------------------------------------------------
         */

        const student =
          await tx.student.findFirst({
            where: {
              id: input.studentId,

              parentId:
                parent.id,

              status:
                StudentStatus.ACTIVE,

              deletedAt: null,
            },

            include: {
              school: {
                include: {
                  settings: true,
                },
              },
            },
          });

        if (!student) {
          throw new Error(
            "Student not available",
          );
        }

        /*
         * ------------------------------------------------------
         * PRE-ORDER ENABLED
         * ------------------------------------------------------
         */

        if (
          !student.school.settings
            ?.preOrderEnabled
        ) {
          throw new Error(
            "Pre-orders are disabled for this school",
          );
        }

        /*
         * ------------------------------------------------------
         * PICKUP SLOT
         * ------------------------------------------------------
         */

        const pickupSlot =
          await tx.pickupSlot.findFirst(
            {
              where: {
                id:
                  input.pickupSlotId,

                schoolId:
                  student.schoolId,

                isActive: true,
              },
            },
          );

        if (!pickupSlot) {
          throw new Error(
            "Pickup time is not available",
          );
        }

        /*
         * ------------------------------------------------------
         * CUTOFF
         * ------------------------------------------------------
         */

        const now =
          getLocalDateTime(
            student.school.settings
              .timezone,
          );

        if (
          input.pickupDate <
          now.date
        ) {
          throw new Error(
            "Pickup date cannot be in the past",
          );
        }

        if (
          input.pickupDate ===
            now.date &&
          now.time >=
            student.school.settings
              .preOrderCutoffTime
        ) {
          throw new Error(
            `Pre-orders are closed for today after ${student.school.settings.preOrderCutoffTime}`,
          );
        }

        /*
         * ------------------------------------------------------
         * CLEAN ITEMS
         * ------------------------------------------------------
         */

        const cleanItems =
          input.items.filter(
            (item) =>
              Boolean(
                item.productId,
              ) &&
              Number.isInteger(
                item.quantity,
              ) &&
              item.quantity > 0,
          );

        if (!cleanItems.length) {
          throw new Error(
            "Order has no valid items",
          );
        }

        /*
         * ------------------------------------------------------
         * PRODUCT IDS
         * ------------------------------------------------------
         */

        const productIds = [
          ...new Set(
            cleanItems.map(
              (item) =>
                item.productId,
            ),
          ),
        ];

        /*
         * ------------------------------------------------------
         * PRODUCTS + OPTIONS
         * ------------------------------------------------------
         */

        const products =
          await tx.product.findMany({
            where: {
              id: {
                in: productIds,
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
                    sortOrder:
                      "asc",
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
                        sortOrder:
                          "asc",
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
          productIds.length
        ) {
          throw new Error(
            "One or more products are unavailable",
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
         * ------------------------------------------------------
         * NORMALIZE ITEMS
         * ------------------------------------------------------
         */

        let total =
          new Prisma.Decimal(0);

        const normalizedItems =
          cleanItems.map(
            (line) => {
              const product =
                productMap.get(
                  line.productId,
                );

              if (!product) {
                throw new Error(
                  "Product unavailable",
                );
              }

              /*
               * Support both:
               *
               * options:
               * [
               *   {
               *     groupId,
               *     optionId
               *   }
               * ]
               *
               * and:
               *
               * optionIds:
               * [...]
               */

              let requestedOptions =
                line.options ?? [];

              if (
                !requestedOptions.length &&
                line.optionIds?.length
              ) {
                requestedOptions =
                  line.optionIds.map(
                    (optionId) => {
                      const group =
                        product.optionGroups.find(
                          (
                            item,
                          ) =>
                            item.options.some(
                              (
                                option,
                              ) =>
                                option.id ===
                                optionId,
                            ),
                        );

                      if (!group) {
                        throw new Error(
                          `Invalid option for ${product.name}`,
                        );
                      }

                      return {
                        groupId:
                          group.id,

                        optionId,
                      };
                    },
                  );
              }

              /*
               * Prevent duplicate option
               * selections.
               */

              const uniqueSelections =
                new Map<
                  string,
                  PreOrderOptionInput
                >();

              for (const selection of
                requestedOptions) {
                uniqueSelections.set(
                  `${selection.groupId}:${selection.optionId}`,
                  selection,
                );
              }

              const selections = [
                ...uniqueSelections.values(),
              ];

              /*
               * ------------------------------------------------
               * VALIDATE OPTIONS
               * ------------------------------------------------
               */

              const selectedOptions =
                selections.map(
                  (selection) => {
                    const group =
                      product.optionGroups.find(
                        (item) =>
                          item.id ===
                          selection.groupId,
                      );

                    if (!group) {
                      throw new Error(
                        `Invalid option group for ${product.name}`,
                      );
                    }

                    const option =
                      group.options.find(
                        (item) =>
                          item.id ===
                          selection.optionId,
                      );

                    if (!option) {
                      throw new Error(
                        `Invalid option for ${product.name}`,
                      );
                    }

                    return {
                      group,
                      option,
                    };
                  },
                );

              /*
               * ------------------------------------------------
               * CHECK EVERY OPTION GROUP
               * ------------------------------------------------
               */

              for (const group of
                product.optionGroups) {
                const selectedCount =
                  selectedOptions.filter(
                    (selection) =>
                      selection.group.id ===
                      group.id,
                  ).length;

                const minimum =
                  Math.max(
                    group.minSelections,
                    group.isRequired
                      ? 1
                      : 0,
                  );

                if (
                  selectedCount <
                  minimum
                ) {
                  throw new Error(
                    `${group.name}: please select at least ${minimum} option${
                      minimum === 1
                        ? ""
                        : "s"
                    } for ${product.name}`,
                  );
                }

                if (
                  group.maxSelections >
                    0 &&
                  selectedCount >
                    group.maxSelections
                ) {
                  throw new Error(
                    `${group.name}: maximum ${group.maxSelections} option${
                      group.maxSelections ===
                      1
                        ? ""
                        : "s"
                    } allowed for ${product.name}`,
                  );
                }
              }

              /*
               * ------------------------------------------------
               * OPTION PRICE
               * ------------------------------------------------
               */

              const optionsTotal =
                selectedOptions.reduce(
                  (
                    sum,
                    selection,
                  ) =>
                    sum.add(
                      selection.option
                        .additionalPrice,
                    ),

                  new Prisma.Decimal(
                    0,
                  ),
                );

              /*
               * ------------------------------------------------
               * UNIT PRICE
               * ------------------------------------------------
               */

              const unitPrice =
                product.price.add(
                  optionsTotal,
                );

              /*
               * ------------------------------------------------
               * LINE TOTAL
               * ------------------------------------------------
               */

              const lineTotal =
                unitPrice.mul(
                  line.quantity,
                );

              total =
                total.add(
                  lineTotal,
                );

              return {
                product,
                quantity:
                  line.quantity,
                unitPrice,
                lineTotal,
                selectedOptions,
              };
            },
          );

        /*
         * ------------------------------------------------------
         * DAILY SPENDING LIMIT
         * ------------------------------------------------------
         */

        if (
          student.dailySpendLimit !==
          null
        ) {
          const today =
            new Date();

          const start =
            new Date(today);

          start.setHours(
            0,
            0,
            0,
            0,
          );

          const end =
            new Date(start);

          end.setDate(
            end.getDate() + 1,
          );

          const [
            salesToday,
            preOrdersToday,
          ] = await Promise.all([
            tx.sale.aggregate({
              where: {
                studentId:
                  student.id,

                createdAt: {
                  gte: start,
                  lt: end,
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
                  gte: start,
                  lt: end,
                },

                status: {
                  in: [
                    PreOrderStatus.CONFIRMED,
                    PreOrderStatus.PREPARING,
                    PreOrderStatus.READY,
                    PreOrderStatus.PICKED_UP,
                  ],
                },
              },

              _sum: {
                total: true,
              },
            }),
          ]);

          const spent =
            new Prisma.Decimal(
              salesToday._sum.total ??
                0,
            ).add(
              new Prisma.Decimal(
                preOrdersToday._sum
                  .total ?? 0,
              ),
            );

          const projected =
            spent.add(total);

          if (
            projected.gt(
              student.dailySpendLimit,
            )
          ) {
            const remaining =
              student.dailySpendLimit.sub(
                spent,
              );

            throw new Error(
              remaining.gt(0)
                ? `Daily spending limit exceeded. This student has $${remaining.toFixed(
                    2,
                  )} remaining today.`
                : "Daily spending limit reached.",
            );
          }
        }

        /*
         * ------------------------------------------------------
         * WALLET
         * ------------------------------------------------------
         */

        const newBalance =
          parent.wallet.balance.sub(
            total,
          );

        if (
          newBalance.lt(0)
        ) {
          throw new Error(
            "Insufficient family wallet balance for this pre-order",
          );
        }

        /*
         * Optimistic balance guard.
         */

        const walletUpdated =
          await tx.wallet.updateMany({
            where: {
              id: parent.wallet.id,

              balance:
                parent.wallet.balance,
            },

            data: {
              balance:
                newBalance,
            },
          });

        if (
          walletUpdated.count !==
          1
        ) {
          throw new Error(
            "Wallet balance changed. Please retry the order.",
          );
        }

        /*
         * ------------------------------------------------------
         * CREATE ORDER
         * ------------------------------------------------------
         */

        const pickupDate =
          new Date(
            `${input.pickupDate}T00:00:00.000Z`,
          );

        const orderNumber =
          `PO-${Date.now()}-${randomUUID()
            .slice(0, 6)
            .toUpperCase()}`;

        const order =
          await tx.preOrder.create({
            data: {
              orderNumber,

              idempotencyKey:
                input.idempotencyKey,

              schoolId:
                student.schoolId,

              studentId:
                student.id,

              walletId:
                parent.wallet.id,

              pickupSlotId:
                pickupSlot.id,

              pickupDate,

              status:
                PreOrderStatus.CONFIRMED,

              total,

              items: {
                create:
                  normalizedItems.map(
                    (line) => ({
                      productId:
                        line.product.id,

                      quantity:
                        line.quantity,

                      unitPrice:
                        line.unitPrice,

                      lineTotal:
                        line.lineTotal,

                      options: {
                        create:
                          line.selectedOptions.map(
                            (
                              selection,
                            ) => ({
                              productOptionId:
                                selection
                                  .option
                                  .id,

                              optionName:
                                selection
                                  .option
                                  .name,

                              additionalPrice:
                                selection
                                  .option
                                  .additionalPrice,

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
         * ------------------------------------------------------
         * WALLET TRANSACTION
         * ------------------------------------------------------
         */

        await tx.walletTransaction.create(
          {
            data: {
              walletId:
                parent.wallet.id,

              studentId:
                student.id,

              type:
                WalletTransactionType.PREORDER_DEBIT,

              amount:
                total.neg(),

              balanceAfter:
                newBalance,

              description:
                `Pre-order ${order.orderNumber}`,

              preOrderId:
                order.id,
            },
          },
        );

        /*
         * ------------------------------------------------------
         * NOTIFICATION
         * ------------------------------------------------------
         */

        await queueParentNotification({
          tx,

          userId:
            session.user.id,

          parentId:
            parent.id,

          event:
            NotificationEvent.PREORDER_CONFIRMED,

          preferenceKey:
            "notifyPreOrder",

          subject:
            "Pre-order confirmed",

          message:
            `We received pre-order ${order.orderNumber} for ${student.firstName} ${student.lastName}. Pickup: ${pickupSlot.label}. Total: $${total.toFixed(
              2,
            )}.`,

          metadata: {
            preOrderId:
              order.id,

            studentId:
              student.id,
          },

          schoolId:
            student.schoolId,
        });

        return {
          ok: true,

          orderId:
            order.id,

          orderNumber:
            order.orderNumber,

          total:
            total.toFixed(2),

          balanceAfter:
            newBalance.toFixed(2),
        };
      },

      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
      },
    );
  } catch (error) {
    return {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : "Pre-order failed",
    };
  }
}

/* ============================================================
 * CASHIER PRE-ORDERS
 * ============================================================ */

export async function getCashierPreOrders(
  date?: string,
) {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(
      session.user.role as UserRole,
    )
  ) {
    throw new Error(
      "Unauthorized",
    );
  }

  const where: Prisma.PreOrderWhereInput =
    {
      status: {
        in: [
          PreOrderStatus.CONFIRMED,
          PreOrderStatus.PREPARING,
          PreOrderStatus.READY,
        ],
      },
    };

  if (
    session.user.role !==
      UserRole.SUPER_ADMIN &&
    session.user.schoolId
  ) {
    where.schoolId =
      session.user.schoolId;
  }

  if (date) {
    const start =
      new Date(
        `${date}T00:00:00.000Z`,
      );

    const end =
      new Date(start);

    end.setUTCDate(
      end.getUTCDate() + 1,
    );

    where.pickupDate = {
      gte: start,
      lt: end,
    };
  }

  return prisma.preOrder.findMany({
    where,

    include: {
      student: true,

      school: true,

      pickupSlot: true,

      items: {
        include: {
          product: true,

          options: true,
        },
      },
    },

    orderBy: [
      {
        pickupDate: "asc",
      },

      {
        pickupSlot: {
          sortOrder: "asc",
        },
      },

      {
        createdAt: "asc",
      },
    ],
  });
}

/* ============================================================
 * UPDATE PRE-ORDER STATUS
 * ============================================================ */

export async function updatePreOrderStatus(
  orderId: string,
  status:
    | "PREPARING"
    | "READY"
    | "PICKED_UP",
): Promise<UpdatePreOrderStatusResult> {
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

  try {
    return await prisma.$transaction(
      async (tx) => {
        const order =
          await tx.preOrder.findUnique(
            {
              where: {
                id: orderId,
              },

              include: {
                student: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          );

        if (!order) {
          throw new Error(
            "Order not found",
          );
        }

        if (
          session.user.role !==
            UserRole.SUPER_ADMIN &&
          session.user.schoolId !==
            order.schoolId
        ) {
          throw new Error(
            "Unauthorized",
          );
        }

        const target =
          status as PreOrderStatus;

        const allowed: Record<
          string,
          PreOrderStatus[]
        > = {
          CONFIRMED: [
            PreOrderStatus.PREPARING,
            PreOrderStatus.READY,
          ],

          PREPARING: [
            PreOrderStatus.READY,
          ],

          READY: [
            PreOrderStatus.PICKED_UP,
          ],
        };

        if (
          !allowed[
            order.status
          ]?.includes(target)
        ) {
          throw new Error(
            `Cannot move ${order.status} to ${target}`,
          );
        }

        const data: Prisma.PreOrderUpdateInput =
          {
            status: target,
          };

        if (
          target ===
          PreOrderStatus.READY
        ) {
          data.readyAt =
            new Date();
        }

        if (
          target ===
          PreOrderStatus.PICKED_UP
        ) {
          data.pickedUpAt =
            new Date();
        }

        const updated =
          await tx.preOrder.update({
            where: {
              id: order.id,
            },

            data,
          });

        return {
          ok: true,

          status:
            updated.status,
        };
      },
    );
  } catch (error) {
    return {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : "Update failed",
    };
  }
}

/* ============================================================
 * MARK LABEL PRINTED
 * ============================================================ */

export async function markPreOrderLabelPrinted(
  orderId: string,
): Promise<
  | {
      ok: true;
    }
  | {
      ok: false;
      error?: string;
    }
> {
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

  const order =
    await prisma.preOrder.findUnique(
      {
        where: {
          id: orderId,
        },
      },
    );

  if (!order) {
    return {
      ok: false,
      error: "Order not found",
    };
  }

  if (
    session.user.role !==
      UserRole.SUPER_ADMIN &&
    session.user.schoolId !==
      order.schoolId
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  await prisma.preOrder.update({
    where: {
      id: order.id,
    },

    data: {
      labelPrintedAt:
        new Date(),
    },
  });

  return {
    ok: true,
  };
}

/* ============================================================
 * CANCEL OWN PRE-ORDER
 * ============================================================ */

export async function cancelOwnPreOrder(
  orderId: string,
): Promise<CancelPreOrderResult> {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.role !==
      UserRole.PARENT
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const parent =
          await tx.parentProfile.findUnique(
            {
              where: {
                userId:
                  session.user.id,
              },

              include: {
                wallet: true,
              },
            },
          );

        if (!parent?.wallet) {
          throw new Error(
            "Wallet not found",
          );
        }

        const order =
          await tx.preOrder.findFirst(
            {
              where: {
                id: orderId,

                walletId:
                  parent.wallet.id,
              },
            },
          );

        if (!order) {
          throw new Error(
            "Order not found",
          );
        }

        if (
          order.status !==
          PreOrderStatus.CONFIRMED
        ) {
          throw new Error(
            "This order can no longer be cancelled",
          );
        }

        const changed =
          await tx.preOrder.updateMany(
            {
              where: {
                id: order.id,

                status:
                  PreOrderStatus.CONFIRMED,
              },

              data: {
                status:
                  PreOrderStatus.CANCELLED,

                cancelledAt:
                  new Date(),
              },
            },
          );

        if (
          changed.count !== 1
        ) {
          throw new Error(
            "Order status changed. Please refresh.",
          );
        }

        const wallet =
          await tx.wallet.findUnique(
            {
              where: {
                id: parent.wallet.id,
              },
            },
          );

        if (!wallet) {
          throw new Error(
            "Wallet not found",
          );
        }

        const balanceAfter =
          wallet.balance.add(
            order.total,
          );

        await tx.wallet.update({
          where: {
            id: wallet.id,
          },

          data: {
            balance:
              balanceAfter,
          },
        });

        await tx.walletTransaction.create(
          {
            data: {
              walletId:
                wallet.id,

              studentId:
                order.studentId,

              type:
                WalletTransactionType.REFUND,

              amount:
                order.total,

              balanceAfter,

              description:
                `Refund for cancelled pre-order ${order.orderNumber}`,
            },
          },
        );

        return {
          ok: true,

          balanceAfter:
            balanceAfter.toFixed(2),
        };
      },

      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
      },
    );
  } catch (error) {
    return {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : "Cancellation failed",
    };
  }
}

/* ============================================================
 * FORM ACTION
 * ============================================================ */

export async function cancelOwnPreOrderFromForm(
  formData: FormData,
): Promise<void> {
  const orderId =
    String(
      formData.get(
        "orderId",
      ) ?? "",
    ).trim();

  if (!orderId) {
    throw new Error(
      "Order ID is required",
    );
  }

  const result =
    await cancelOwnPreOrder(
      orderId,
    );

  if (!result.ok) {
    throw new Error(
      result.error,
    );
  }

  revalidatePath(
    "/parent/preorders",
  );

  revalidatePath(
    "/parent/wallet",
  );
}