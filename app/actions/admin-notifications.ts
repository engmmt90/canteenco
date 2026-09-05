"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function markAllAdminNotificationsRead() {
  await requireAdmin();

  await prisma.notification.updateMany({
    where: {
      adminClearedAt: null,
      adminReadAt: null,
    },
    data: {
      adminReadAt: new Date(),
    },
  });

  revalidatePath("/admin/notifications");
}

export async function clearAdminNotifications() {
  await requireAdmin();

  const now = new Date();

  /*
   * Do not delete notification rows.
   * Pending EMAIL/SMS notifications may still be needed by the worker.
   * Clearing only hides them from the Admin Notifications page.
   */
  await prisma.notification.updateMany({
    where: {
      adminClearedAt: null,
    },
    data: {
      adminReadAt: now,
      adminClearedAt: now,
    },
  });

  revalidatePath("/admin/notifications");
}