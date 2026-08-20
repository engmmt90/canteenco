"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireParent } from "@/lib/authz";
import { queueParentNotification } from "@/lib/notifications";
import { NotificationEvent } from "@prisma/client";

export type TopUpFormState = {
  error?: string;
  success?: string;
};

const PRESET_AMOUNTS = new Set([5, 10, 20, 50, 100]);
const MIN_CUSTOM_AMOUNT = 1;
const MAX_TOP_UP_AMOUNT = 1000;

function formString(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function parseMoney(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100) / 100;
}

type NotificationTx = {
  notificationPreference: typeof prisma.notificationPreference;
  notification: typeof prisma.notification;
};

async function queueTopUpNotifications(
  tx: NotificationTx,
  userId: string,
  parentId: string,
  event: "TOPUP_REQUESTED" | "TOPUP_CONFIRMED",
  subject: string,
  message: string,
  metadata: Record<string, string | number>,
) {
  const preferences = await tx.notificationPreference.findUnique({
    where: { parentId },
    select: { emailEnabled: true, smsEnabled: true, pushEnabled: true, notifyTopUp: true },
  });

  if (!preferences?.notifyTopUp) return;

  const channels: Array<"IN_APP" | "EMAIL" | "SMS" | "PUSH"> = ["IN_APP"];
  if (preferences.emailEnabled) channels.push("EMAIL");
  if (preferences.smsEnabled) channels.push("SMS");
  if (preferences.pushEnabled) channels.push("PUSH");

  await tx.notification.createMany({
    data: channels.map((channel) => ({
      userId,
      channel,
      event,
      subject,
      message,
      metadata,
    })),
  });
}

export async function createTopUpRequest(
  _previousState: TopUpFormState,
  formData: FormData,
): Promise<TopUpFormState> {
  const session = await requireParent();
  const amountMode = formString(formData, "amountMode");
  const presetValue = formString(formData, "presetAmount");
  const customValue = formString(formData, "customAmount");

  const rawAmount = amountMode === "custom" ? customValue : presetValue;
  const amount = parseMoney(rawAmount);

  if (amount === null) return { error: "Enter a valid top-up amount." };
  if (amountMode !== "custom" && !PRESET_AMOUNTS.has(amount)) {
    return { error: "Choose one of the preset top-up amounts." };
  }
  if (amount < MIN_CUSTOM_AMOUNT || amount > MAX_TOP_UP_AMOUNT) {
    return { error: `Top-up requests must be between $${MIN_CUSTOM_AMOUNT} and $${MAX_TOP_UP_AMOUNT}.` };
  }

  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: { wallet: true },
  });

  if (!parent?.wallet) return { error: "Your family wallet is not available yet." };
  if (parent.wallet.status !== "ACTIVE") return { error: "Your family wallet is not active." };

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.topUpRequest.create({
      data: {
        walletId: parent.wallet!.id,
        requestedById: session.user.id,
        amount,
        status: "PENDING",
      },
    });

    await queueParentNotification({
      tx,
      userId: session.user.id,
      parentId: parent.id,
      event: NotificationEvent.TOPUP_REQUESTED,
      preferenceKey: "notifyTopUp",
      subject: "Top-up request received",
      message: `We received your request to add $${amount.toFixed(2)} to your CanteenCo family wallet. The balance will update after cash payment is confirmed by the administrator.`,
      metadata: { topUpRequestId: created.id, amount },
    });

    return created;
  });

  revalidatePath("/parent/wallet");
  revalidatePath("/admin/topups");
  revalidatePath("/admin");
  return { success: `Top-up request submitted: $${Number(request.amount).toFixed(2)}.` };
}

export async function cancelOwnTopUpRequest(formData: FormData) {
  const session = await requireParent();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { wallet: { select: { id: true } } },
  });
  if (!parent?.wallet) return;

  await prisma.topUpRequest.updateMany({
    where: {
      id: requestId,
      walletId: parent.wallet.id,
      requestedById: session.user.id,
      status: "PENDING",
    },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  revalidatePath("/parent/wallet");
  revalidatePath("/admin/topups");
  revalidatePath("/admin");
}

export async function confirmTopUpRequest(formData: FormData) {
  const session = await requireAdmin();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  await prisma.$transaction(async (tx) => {
    const request = await tx.topUpRequest.findUnique({
      where: { id: requestId },
      include: {
        wallet: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!request || request.status !== "PENDING") return;
    if (request.wallet.status !== "ACTIVE") throw new Error("The family wallet is not active.");

    // Conditional update is the idempotency gate: only one confirmer can move
    // this request out of PENDING, preventing accidental double credits.
    const claimed = await tx.topUpRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        confirmedById: session.user.id,
        confirmedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return;

    const wallet = await tx.wallet.update({
      where: { id: request.walletId },
      data: { balance: { increment: request.amount } },
      select: { balance: true },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: request.walletId,
        type: "TOP_UP",
        amount: request.amount,
        balanceAfter: wallet.balance,
        description: "Cash top-up confirmed by administrator",
        topUpRequestId: request.id,
      },
    });

    await queueParentNotification({
      tx,
      userId: request.wallet.parent.user.id,
      parentId: request.wallet.parent.id,
      event: NotificationEvent.TOPUP_CONFIRMED,
      preferenceKey: "notifyTopUp",
      subject: "Family wallet topped up",
      message: `Your cash payment has been confirmed. $${Number(request.amount).toFixed(2)} was added to your CanteenCo family wallet. New balance: $${Number(wallet.balance).toFixed(2)}.`,
      metadata: {
        topUpRequestId: request.id,
        amount: Number(request.amount),
        balanceAfter: Number(wallet.balance),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "CONFIRM_CASH_TOP_UP",
        entityType: "TopUpRequest",
        entityId: request.id,
        metadata: {
          amount: Number(request.amount),
          walletId: request.walletId,
          parentUserId: request.wallet.parent.user.id,
          balanceAfter: Number(wallet.balance),
        },
      },
    });
  });

  revalidatePath("/admin/topups");
  revalidatePath("/admin");
  revalidatePath("/parent/wallet");
  revalidatePath("/parent/dashboard");
}

export async function cancelTopUpRequestAsAdmin(formData: FormData) {
  const session = await requireAdmin();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.topUpRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (cancelled.count !== 1) return;

    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "CANCEL_TOP_UP_REQUEST",
        entityType: "TopUpRequest",
        entityId: requestId,
      },
    });
  });

  revalidatePath("/admin/topups");
  revalidatePath("/admin");
  revalidatePath("/parent/wallet");
}
