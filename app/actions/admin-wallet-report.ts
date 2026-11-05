"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buildWalletReportPdf,
  formatBrisbaneDateTime,
  getWalletReportData,
} from "@/lib/wallet-report";
import { sendEmail } from "@/lib/notification-providers";
import { saveWalletReportSettings, validEmail } from "@/lib/daily-wallet-report";

export async function emailWalletReportToMe(formData: FormData) {
  const session =
    await requireAdmin();

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        email: true,
        fullName: true,
      },
    });

  if (!user?.email) {
    throw new Error(
      "Admin email address is missing.",
    );
  }

  const additionalEmail = String(formData.get("additionalEmail") ?? "").trim();

  if (additionalEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(additionalEmail) || additionalEmail.length > 254)) {
    throw new Error("Enter a valid additional email address.");
  }

  const recipients = additionalEmail && additionalEmail.toLowerCase() !== user.email.toLowerCase()
    ? [user.email, additionalEmail]
    : [user.email];

  const report =
    await getWalletReportData();

  const pdf =
    await buildWalletReportPdf(
      report,
    );

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  await sendEmail({
    to: recipients,
    subject:
      "CanteenCo Wallet Balance Report",
    text:
      `Hi ${user.fullName},\n\n` +
      `Attached is the CanteenCo wallet balance report.\n\n` +
      `Wallets: ${report.rows.length}\n` +
      `Total balance: $${report.totalBalance.toFixed(2)}\n\n` +
      `Generated: ${formatBrisbaneDateTime(report.generatedAt)}`,
    attachments: [
      {
        filename:
          `canteenco-wallet-report-${date}.pdf`,
        content:
          pdf.toString(
            "base64",
          ),
      },
    ],
  });

  redirect(
    "/admin/wallets?reportEmail=sent",
  );
}

export async function saveDailyWalletReportSettings(formData: FormData) {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, schoolId: true },
  });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "SCHOOL_ADMIN")) {
    throw new Error("Admin access required.");
  }
  const additionalEmail = String(formData.get("additionalEmail") ?? "").trim();
  const sendTime = String(formData.get("sendTime") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Australia/Brisbane").trim();
  if (additionalEmail && !validEmail(additionalEmail)) {
    throw new Error("Enter a valid additional email address.");
  }
  if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(sendTime)) {
    throw new Error("Enter a valid time.");
  }
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: timezone });
  } catch {
    throw new Error("Enter a valid timezone.");
  }
  await saveWalletReportSettings(user.id, {
    enabled: formData.get("enabled") === "on",
    sendTime,
    additionalEmail: additionalEmail || null,
    timezone,
  });
  redirect("/admin/wallets?reportSchedule=saved");
}
