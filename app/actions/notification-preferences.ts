"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function saveNotificationPreferences(formData: FormData) {
  const session = await requireParent();
  const parent = await prisma.parentProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!parent) throw new Error("Parent profile not found");

  const thresholdRaw = String(formData.get("lowBalanceThreshold") ?? "").trim();
  const threshold = thresholdRaw === "" ? null : Number(thresholdRaw);
  if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1000)) {
    throw new Error("Low balance threshold must be between $0 and $1000");
  }

  await prisma.notificationPreference.upsert({
    where: { parentId: parent.id },
    create: {
      parentId: parent.id,
      emailEnabled: checked(formData, "emailEnabled"),
      smsEnabled: checked(formData, "smsEnabled"),
      pushEnabled: checked(formData, "pushEnabled"),
      notifyTopUp: checked(formData, "notifyTopUp"),
      notifyPurchase: checked(formData, "notifyPurchase"),
      notifyPreOrder: checked(formData, "notifyPreOrder"),
      notifyPickup: checked(formData, "notifyPickup"),
      notifyRefund: checked(formData, "notifyRefund"),
      notifyLowBalance: checked(formData, "notifyLowBalance"),
      lowBalanceThreshold: threshold,
    },
    update: {
      emailEnabled: checked(formData, "emailEnabled"),
      smsEnabled: checked(formData, "smsEnabled"),
      pushEnabled: checked(formData, "pushEnabled"),
      notifyTopUp: checked(formData, "notifyTopUp"),
      notifyPurchase: checked(formData, "notifyPurchase"),
      notifyPreOrder: checked(formData, "notifyPreOrder"),
      notifyPickup: checked(formData, "notifyPickup"),
      notifyRefund: checked(formData, "notifyRefund"),
      notifyLowBalance: checked(formData, "notifyLowBalance"),
      lowBalanceThreshold: threshold,
    },
  });

  revalidatePath("/parent/settings/notifications");
  revalidatePath("/parent/dashboard");
}
