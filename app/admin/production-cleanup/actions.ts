"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function deleteTrialData(formData: FormData) {
  const session = await requireAdmin();

  if (session.user.role !== "SUPER_ADMIN") {
    throw new Error("Super Admin only");
  }

  if (str(formData, "confirmation") !== "DELETE TEST DATA") {
    throw new Error('Type DELETE TEST DATA exactly to continue.');
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.walletTransaction.deleteMany();

      await tx.saleItemOption.deleteMany();
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();

      await tx.preOrderItemOption.deleteMany();
      await tx.preOrderItem.deleteMany();
      await tx.preOrder.deleteMany();

      await tx.topUpRequest.deleteMany();

      await tx.notification.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.staffAttendance.deleteMany();
      await tx.loginThrottle.deleteMany();

      await tx.studentRegistrationRequest.deleteMany();
      await tx.parentRegistrationRequest.deleteMany();

      const parentUsers = await tx.user.findMany({
        where: { role: "PARENT" },
        select: { id: true },
      });

      const parentUserIds = parentUsers.map((user) => user.id);

      if (parentUserIds.length > 0) {
        await tx.passwordResetToken.deleteMany({
          where: { userId: { in: parentUserIds } },
        });

        await tx.mobileRefreshSession.deleteMany({
          where: { userId: { in: parentUserIds } },
        });

        await tx.pushDevice.deleteMany({
          where: { userId: { in: parentUserIds } },
        });
      }

      await tx.student.deleteMany();
      await tx.notificationPreference.deleteMany();
      await tx.wallet.deleteMany();
      await tx.parentProfile.deleteMany();

      await tx.user.deleteMany({
        where: { role: "PARENT" },
      });
    },
    {
      maxWait: 10000,
      timeout: 120000,
    },
  );

  revalidatePath("/admin");
  revalidatePath("/admin/production-cleanup");
  revalidatePath("/admin/parents");
  revalidatePath("/admin/students");
  revalidatePath("/admin/wallets");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/topups");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/audit");

  redirect("/admin/production-cleanup?done=1");
}
