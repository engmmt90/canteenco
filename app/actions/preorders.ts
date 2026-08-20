"use server";

import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
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
} from "@prisma/client";

function localDateTime(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export async function getParentPreOrderData() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.PARENT) throw new Error("Unauthorized");
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      wallet: true,
      students: {
        where: { status: StudentStatus.ACTIVE, deletedAt: null },
        include: { school: { include: { settings: true, pickupSlots: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
    },
  });
  const products = await prisma.product.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return { parent, products };
}

type PreOrderLine = { productId: string; quantity: number };

export async function createParentPreOrder(input: {
  studentId: string;
  pickupSlotId: string;
  pickupDate: string; // YYYY-MM-DD
  items: PreOrderLine[];
  idempotencyKey: string;
}) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.PARENT) return { ok: false, error: "Unauthorized" };
  if (!input.idempotencyKey || !input.pickupDate || !input.items.length) return { ok: false, error: "Incomplete order" };

  try {
    return await prisma.$transaction(async tx => {
      const existing = await tx.preOrder.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { ok: true, orderId: existing.id, orderNumber: existing.orderNumber, duplicate: true };

      const parent = await tx.parentProfile.findUnique({ where: { userId: session.user.id }, include: { wallet: true } });
      if (!parent?.wallet || parent.wallet.status !== WalletStatus.ACTIVE) throw new Error("Family wallet is not active");

      const student = await tx.student.findFirst({
        where: { id: input.studentId, parentId: parent.id, status: StudentStatus.ACTIVE, deletedAt: null },
        include: { school: { include: { settings: true } } },
      });
      if (!student) throw new Error("Student not available");
      if (!student.school.settings?.preOrderEnabled) throw new Error("Pre-orders are disabled for this school");

      const slot = await tx.pickupSlot.findFirst({ where: { id: input.pickupSlotId, schoolId: student.schoolId, isActive: true } });
      if (!slot) throw new Error("Pickup time is not available");

      const today = localDateTime(student.school.settings.timezone);
      if (input.pickupDate < today.date) throw new Error("Pickup date cannot be in the past");
      if (input.pickupDate === today.date && today.time >= student.school.settings.preOrderCutoffTime) {
        throw new Error(`Pre-orders are closed for today after ${student.school.settings.preOrderCutoffTime}`);
      }

      const clean = input.items.filter(x => Number.isInteger(x.quantity) && x.quantity > 0);
      const ids = [...new Set(clean.map(x => x.productId))];
      const products = await tx.product.findMany({ where: { id: { in: ids }, isActive: true, deletedAt: null } });
      if (!clean.length || products.length !== ids.length) throw new Error("One or more products are unavailable");
      const productMap = new Map(products.map(p => [p.id, p]));
      let total = new Prisma.Decimal(0);
      for (const line of clean) total = total.add(productMap.get(line.productId)!.price.mul(line.quantity));

      const proposed = parent.wallet.balance.sub(total);
      if (proposed.lt(0)) throw new Error("Insufficient family wallet balance for this pre-order");

      const guarded = await tx.wallet.updateMany({
        where: { id: parent.wallet.id, balance: parent.wallet.balance },
        data: { balance: proposed },
      });
      if (guarded.count !== 1) throw new Error("Wallet balance changed. Please retry the order.");

      const pickupDate = new Date(`${input.pickupDate}T00:00:00.000Z`);
      const order = await tx.preOrder.create({
        data: {
          orderNumber: `PO-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
          idempotencyKey: input.idempotencyKey,
          schoolId: student.schoolId,
          studentId: student.id,
          walletId: parent.wallet.id,
          pickupSlotId: slot.id,
          pickupDate,
          status: PreOrderStatus.CONFIRMED,
          total,
          items: {
            create: clean.map(line => {
              const p = productMap.get(line.productId)!;
              return { productId: p.id, quantity: line.quantity, unitPrice: p.price, lineTotal: p.price.mul(line.quantity) };
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
          balanceAfter: proposed,
          description: `Pre-order ${order.orderNumber}`,
          preOrderId: order.id,
        },
      });

      await queueParentNotification({
        tx,
        userId: session.user.id,
        parentId: parent.id,
        event: NotificationEvent.PREORDER_CONFIRMED,
        preferenceKey: "notifyPreOrder",
        subject: "Pre-order confirmed",
        message: `We received pre-order ${order.orderNumber} for ${student.firstName} ${student.lastName}. Pickup: ${slot.label}. Total: $${total.toFixed(2)}.`,
        metadata: { preOrderId: order.id, studentId: student.id },
      });

      return { ok: true, orderId: order.id, orderNumber: order.orderNumber, total: total.toFixed(2), balanceAfter: proposed.toFixed(2) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Pre-order failed" };
  }
}

export async function getCashierPreOrders(date?: string) {
  const session = await auth();
  if (!session?.user?.id || ![UserRole.CASHIER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN].includes(session.user.role as UserRole)) throw new Error("Unauthorized");
  const where: Prisma.PreOrderWhereInput = { status: { in: [PreOrderStatus.CONFIRMED, PreOrderStatus.PREPARING, PreOrderStatus.READY] } };
  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.schoolId) where.schoolId = session.user.schoolId;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    where.pickupDate = { gte: start, lt: end };
  }
  return prisma.preOrder.findMany({
    where,
    include: {
      student: true,
      school: true,
      pickupSlot: true,
      items: { include: { product: true } },
    },
    orderBy: [{ pickupDate: "asc" }, { pickupSlot: { sortOrder: "asc" } }, { createdAt: "asc" }],
  });
}

export async function updatePreOrderStatus(orderId: string, status: "PREPARING" | "READY" | "PICKED_UP") {
  const session = await auth();
  if (!session?.user?.id || ![UserRole.CASHIER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN].includes(session.user.role as UserRole)) return { ok: false, error: "Unauthorized" };
  const target = status as PreOrderStatus;
  try {
    return await prisma.$transaction(async tx => {
      const order = await tx.preOrder.findUnique({
        where: { id: orderId },
        include: { student: { include: { parent: { include: { user: true } } } } },
      });
      if (!order) throw new Error("Order not found");
      if (session.user.role !== UserRole.SUPER_ADMIN && session.user.schoolId !== order.schoolId) throw new Error("Unauthorized");

      const allowed: Record<string, PreOrderStatus[]> = {
        CONFIRMED: [PreOrderStatus.PREPARING, PreOrderStatus.READY],
        PREPARING: [PreOrderStatus.READY],
        READY: [PreOrderStatus.PICKED_UP],
      };
      if (!allowed[order.status]?.includes(target)) throw new Error(`Cannot move ${order.status} to ${target}`);

      const data: Prisma.PreOrderUpdateInput = { status: target };
      if (target === PreOrderStatus.READY) data.readyAt = new Date();
      if (target === PreOrderStatus.PICKED_UP) data.pickedUpAt = new Date();
      const updated = await tx.preOrder.update({ where: { id: order.id }, data });

      if (target === PreOrderStatus.READY) {
        await queueParentNotification({
          tx,
          userId: order.student.parent.userId,
          parentId: order.student.parent.id,
          event: NotificationEvent.PREORDER_READY,
          preferenceKey: "notifyPreOrder",
          subject: "Order ready",
          message: `Order ${order.orderNumber} for ${order.student.firstName} is ready for pickup.`,
          metadata: { preOrderId: order.id },
        });
      }
      if (target === PreOrderStatus.PICKED_UP) {
        await queueParentNotification({
          tx,
          userId: order.student.parent.userId,
          parentId: order.student.parent.id,
          event: NotificationEvent.PREORDER_PICKED_UP,
          preferenceKey: "notifyPickup",
          subject: "Order picked up",
          message: `Order ${order.orderNumber} for ${order.student.firstName} has been picked up.`,
          metadata: { preOrderId: order.id },
        });
      }
      return { ok: true, status: updated.status };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function markPreOrderLabelPrinted(orderId: string) {
  const session = await auth();
  if (!session?.user?.id || ![UserRole.CASHIER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN].includes(session.user.role as UserRole)) return { ok: false };
  const order = await prisma.preOrder.findUnique({ where: { id: orderId } });
  if (!order || (session.user.role !== UserRole.SUPER_ADMIN && session.user.schoolId !== order.schoolId)) return { ok: false };
  await prisma.preOrder.update({ where: { id: order.id }, data: { labelPrintedAt: new Date() } });
  return { ok: true };
}


export async function cancelOwnPreOrder(orderId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.PARENT) return { ok: false, error: "Unauthorized" };
  try {
    return await prisma.$transaction(async tx => {
      const parent = await tx.parentProfile.findUnique({ where: { userId: session.user.id }, include: { wallet: true } });
      if (!parent?.wallet) throw new Error("Wallet not found");
      const order = await tx.preOrder.findFirst({
        where: { id: orderId, walletId: parent.wallet.id },
        include: { student: true },
      });
      if (!order) throw new Error("Order not found");
      if (order.status !== PreOrderStatus.CONFIRMED) throw new Error("This order can no longer be cancelled");

      const updated = await tx.preOrder.updateMany({
        where: { id: order.id, status: PreOrderStatus.CONFIRMED },
        data: { status: PreOrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (updated.count !== 1) throw new Error("Order status changed. Please refresh.");

      const wallet = await tx.wallet.findUnique({ where: { id: parent.wallet.id } });
      if (!wallet) throw new Error("Wallet not found");
      const newBalance = wallet.balance.add(order.total);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          studentId: order.studentId,
          type: WalletTransactionType.REFUND,
          amount: order.total,
          balanceAfter: newBalance,
          description: `Refund for cancelled pre-order ${order.orderNumber}`,
        },
      });
      await queueParentNotification({
        tx,
        userId: session.user.id,
        parentId: parent.id,
        event: NotificationEvent.PREORDER_CANCELLED,
        preferenceKey: "notifyRefund",
        subject: "Pre-order cancelled",
        message: `Order ${order.orderNumber} was cancelled and $${order.total.toFixed(2)} returned to your family wallet.`,
        metadata: { preOrderId: order.id },
      });
      return { ok: true, balanceAfter: newBalance.toFixed(2) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Cancellation failed" };
  }
}


export async function cancelOwnPreOrderFromForm(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "");
  const result = await cancelOwnPreOrder(orderId);
  revalidatePath("/parent/preorders");
  revalidatePath("/parent/wallet");
  return result;
}
