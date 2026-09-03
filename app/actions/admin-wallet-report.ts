"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buildWalletReportPdf,
  getWalletReportData,
} from "@/lib/wallet-report";
import { sendEmail } from "@/lib/notification-providers";

export async function emailWalletReportToMe() {
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
    to: user.email,
    subject:
      "CanteenCo Wallet Balance Report",
    text:
      `Hi ${user.fullName},\n\n` +
      `Attached is the CanteenCo wallet balance report.\n\n` +
      `Wallets: ${report.rows.length}\n` +
      `Total balance: $${report.totalBalance.toFixed(2)}\n\n` +
      `Generated: ${report.generatedAt.toLocaleString("en-AU")}`,
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