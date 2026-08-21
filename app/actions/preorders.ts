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

type PreOrderLine = {
  productId: string;
  quantity: number;
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

function localDateTime(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export async function getParentPreOrderData() {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.role !== UserRole.PARENT
  ) {
    throw new Error("Unauthorized");
  }

  const parent = await prisma.parentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    include: {
      wallet: true,
      students: {
        where: {
          status: StudentStatus.ACTIVE,
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
  });

  const products = await prisma.product.findMany({
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

  return {
    parent,
    products,
  };
}

export async function createParentPreOrder(input: {
  studentId: string;
  pickupSlotId: string;
  pickupDate: string;
  items: PreOrderLine[];
  idempotencyKey: string;
}): Promise<CreatePreOrderResult> {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.role !== UserRole.PARENT
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  if (
    !input.idempotencyKey ||
    !input.pickupDate ||
    !input.items.length
  ) {
    return {
      ok: false,
      error: "Incomplete order",
    };
  }

  try {
    return await prisma.$transaction(
      async (tx): Promise<CreatePreOrderResult> => {
        const existing = await tx.preOrder.findUnique({
          where: {
            idempotencyKey: input.idempotencyKey,
          },
        });

        if (existing) {
          const transaction =
            await tx.walletTransaction.findUnique({
              where: {
                preOrderId: existing.id,
              },
            });

          return {
            ok: true,
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            total: existing.total.toFixed(2),
            balanceAfter:
              transaction?.balanceAfter.toFixed(2) ?? "",
            duplicate: true,
          };
        }

        const parent =
          await tx.parentProfile.findUnique({
            where: {
              userId: session.user.id,
            },
            include: {
              wallet: true,
            },
          });

        if (
          !parent?.wallet ||
          parent.wallet.status !== WalletStatus.ACTIVE
        ) {
          throw new Error(
            "Family wallet is not active",
          );
        }

        const student = await tx.student.findFirst({
          where: {
            id: input.studentId,
            parentId: parent.id,
            status: StudentStatus.ACTIVE,
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
          throw new Error("Student not available");
        }

        if (!student.school.settings?.preOrderEnabled) {
          throw new Error(
            "Pre-orders are disabled for this school",
          );
        }

        const slot = await tx.pickupSlot.findFirst({
          where: {
            id: input.pickupSlotId,
            schoolId: student.schoolId,
            isActive: true,
          },
        });

        if (!slot) {
          throw new Error(
            "Pickup time is not available",
          );
        }

        const today = localDateTime(
          student.school.settings.timezone,
        );

        if (input.pickupDate < today.date) {
          throw new Error(
            "Pickup date cannot be in the past",
          );
        }

        if (
          input.pickupDate === today.date &&
          today.time >=
            student.school.settings.preOrderCutoffTime
        ) {
          throw new Error(
            `Pre-orders are closed for today after ${student.school.settings.preOrderCutoffTime}`,
          );
        }

        const cleanItems = input.items.filter(
          (item) =>
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            Boolean(item.productId),
        );

        if (!cleanItems.length) {
          throw new Error("Order has no valid items");
        }

        const productIds = [
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
                in: productIds,
              },
              isActive: true,
              deletedAt: null,
            },
          });

        if (
          products.length !== productIds.length
        ) {
          throw new Error(
            "One or more products are unavailable",
          );
        }

        const productMap = new Map(
          products.map((product) => [
            product.id,
            product,
          ]),
        );

        let total = new Prisma.Decimal(0);

        for (const line of cleanItems) {
          const product = productMap.get(
            line.productId,
          );

          if (!product) {
            throw new Error(
              "One or more products are unavailable",
            );
          }

          total = total.add(
            product.price.mul(line.quantity),
          );
        }

        const proposedBalance =
          parent.wallet.balance.sub(total);

        if (proposedBalance.lt(0)) {
          throw new Error(
            "Insufficient family wallet balance for this pre-order",
          );
        }

        const guardedWalletUpdate =
          await tx.wallet.updateMany({
            where: {
              id: parent.wallet.id,
              balance: parent.wallet.balance,
            },
            data: {
              balance: proposedBalance,
            },
          });

        if (guardedWalletUpdate.count !== 1) {
          throw new Error(
            "Wallet balance changed. Please retry the order.",
          );
        }

        const pickupDate = new Date(
          `${input.pickupDate}T00:00:00.000Z`,
        );

        const order = await tx.preOrder.create({
          data: {
            orderNumber: `PO-${Date.now()}-${randomUUID()
              .slice(0, 6)
              .toUpperCase()}`,
            idempotencyKey:
              input.idempotencyKey,
            schoolId: student.schoolId,
            studentId: student.id,
            walletId: parent.wallet.id,
            pickupSlotId: slot.id,
            pickupDate,
            status: PreOrderStatus.CONFIRMED,
            total,
            items: {
              create: cleanItems.map((line) => {
                const product =
                  productMap.get(
                    line.productId,
                  );

                if (!product) {
                  throw new Error(
                    "One or more products are unavailable",
                  );
                }

                return {
                  productId: product.id,
                  quantity: line.quantity,
                  unitPrice: product.price,
                  lineTotal:
                    product.price.mul(
                      line.quantity,
                    ),
                };
              }),
            },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: parent.wallet.id,
            studentId: student.id,
            type: WalletTransactionType.PREORDER_DEBIT,
            amount: total.neg(),
            balanceAfter: proposedBalance,
            description: `Pre-order ${order.orderNumber}`,
            preOrderId: order.id,
          },
        });

        await queueParentNotification({
          tx,
          userId: session.user.id,
          parentId: parent.id,
          event:
            NotificationEvent.PREORDER_CONFIRMED,
          preferenceKey: "notifyPreOrder",
          subject: "Pre-order confirmed",
          message: `We received pre-order ${
            order.orderNumber
          } for ${student.firstName} ${
            student.lastName
          }. Pickup: ${
            slot.label
          }. Total: $${total.toFixed(2)}.`,
          metadata: {
            preOrderId: order.id,
            studentId: student.id,
          },
          schoolId: student.schoolId,
        });

        return {
          ok: true,
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: total.toFixed(2),
          balanceAfter:
            proposedBalance.toFixed(2),
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
    throw new Error("Unauthorized");
  }

  const where: Prisma.PreOrderWhereInput = {
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
    where.schoolId = session.user.schoolId;
  }

  if (date) {
    const start = new Date(
      `${date}T00:00:00.000Z`,
    );

    const end = new Date(start);
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

  const target =
    status as PreOrderStatus;

  try {
    return await prisma.$transaction(
      async (
        tx,
      ): Promise<UpdatePreOrderStatusResult> => {
        const order =
          await tx.preOrder.findUnique({
            where: {
              id: orderId,
            },
            include: {
              student: {
                include: {
                  parent: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          });

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
          throw new Error("Unauthorized");
        }

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
          !allowed[order.status]?.includes(
            target,
          )
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
          target === PreOrderStatus.READY
        ) {
          data.readyAt = new Date();
        }

        if (
          target ===
          PreOrderStatus.PICKED_UP
        ) {
          data.pickedUpAt = new Date();
        }

        const updated =
          await tx.preOrder.update({
            where: {
              id: order.id,
            },
            data,
          });

        if (
          target === PreOrderStatus.READY
        ) {
          await queueParentNotification({
            tx,
            userId:
              order.student.parent.userId,
            parentId:
              order.student.parent.id,
            event:
              NotificationEvent.PREORDER_READY,
            preferenceKey:
              "notifyPreOrder",
            subject: "Order ready",
            message: `Order ${order.orderNumber} for ${order.student.firstName} is ready for pickup.`,
            metadata: {
              preOrderId: order.id,
            },
            schoolId: order.schoolId,
          });
        }

        if (
          target ===
          PreOrderStatus.PICKED_UP
        ) {
          await queueParentNotification({
            tx,
            userId:
              order.student.parent.userId,
            parentId:
              order.student.parent.id,
            event:
              NotificationEvent.PREORDER_PICKED_UP,
            preferenceKey:
              "notifyPickup",
            subject: "Order picked up",
            message: `Order ${order.orderNumber} for ${order.student.firstName} has been picked up.`,
            metadata: {
              preOrderId: order.id,
            },
            schoolId: order.schoolId,
          });
        }

        return {
          ok: true,
          status: updated.status,
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

export async function markPreOrderLabelPrinted(
  orderId: string,
): Promise<
  | { ok: true }
  | { ok: false; error?: string }
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
    await prisma.preOrder.findUnique({
      where: {
        id: orderId,
      },
    });

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
      labelPrintedAt: new Date(),
    },
  });

  return {
    ok: true,
  };
}

export async function cancelOwnPreOrder(
  orderId: string,
): Promise<CancelPreOrderResult> {
  const session = await auth();

  if (
    !session?.user?.id ||
    session.user.role !== UserRole.PARENT
  ) {
    return {
      ok: false,
      error: "Unauthorized",
    };
  }

  try {
    return await prisma.$transaction(
      async (
        tx,
      ): Promise<CancelPreOrderResult> => {
        const parent =
          await tx.parentProfile.findUnique({
            where: {
              userId: session.user.id,
            },
            include: {
              wallet: true,
            },
          });

        if (!parent?.wallet) {
          throw new Error(
            "Wallet not found",
          );
        }

        const order =
          await tx.preOrder.findFirst({
            where: {
              id: orderId,
              walletId: parent.wallet.id,
            },
            include: {
              student: true,
            },
          });

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

        const updated =
          await tx.preOrder.updateMany({
            where: {
              id: order.id,
              status:
                PreOrderStatus.CONFIRMED,
            },
            data: {
              status:
                PreOrderStatus.CANCELLED,
              cancelledAt: new Date(),
            },
          });

        if (updated.count !== 1) {
          throw new Error(
            "Order status changed. Please refresh.",
          );
        }

        const wallet =
          await tx.wallet.findUnique({
            where: {
              id: parent.wallet.id,
            },
          });

        if (!wallet) {
          throw new Error(
            "Wallet not found",
          );
        }

        const newBalance =
          wallet.balance.add(order.total);

        await tx.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            balance: newBalance,
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            studentId: order.studentId,
            type:
              WalletTransactionType.REFUND,
            amount: order.total,
            balanceAfter: newBalance,
            description: `Refund for cancelled pre-order ${order.orderNumber}`,
          },
        });

        await queueParentNotification({
          tx,
          userId: session.user.id,
          parentId: parent.id,
          event:
            NotificationEvent.PREORDER_CANCELLED,
          preferenceKey: "notifyRefund",
          subject:
            "Pre-order cancelled",
          message: `Order ${
            order.orderNumber
          } was cancelled and $${order.total.toFixed(
            2,
          )} returned to your family wallet.`,
          metadata: {
            preOrderId: order.id,
          },
          schoolId: order.schoolId,
        });

        return {
          ok: true,
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
          : "Cancellation failed",
    };
  }
}

export async function cancelOwnPreOrderFromForm(
  formData: FormData,
): Promise<void> {
  const orderId = String(
    formData.get("orderId") ?? "",
  );

  const result =
    await cancelOwnPreOrder(orderId);

  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/parent/preorders");
  revalidatePath("/parent/wallet");
}