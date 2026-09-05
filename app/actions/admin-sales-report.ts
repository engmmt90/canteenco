"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { sendEmail } from "@/lib/notification-providers";

import {
  buildSalesReportPdf,
  formatBrisbaneDateTime,
  getSalesReportData,
  salesParamsToQuery,
  type SalesReportParams,
} from "@/lib/sales-report";

function str(
  f: FormData,
  key: string,
) {
  return String(
    f.get(key) ?? "",
  ).trim();
}

export async function emailSalesReportToMe(
  formData: FormData,
) {
  const session =
    await requireAdmin();

  const params: SalesReportParams = {
    range:
      str(
        formData,
        "range",
      ) || "today",
    from:
      str(
        formData,
        "from",
      ) || undefined,
    to:
      str(
        formData,
        "to",
      ) || undefined,
    school:
      str(
        formData,
        "school",
      ) || undefined,
    status:
      str(
        formData,
        "status",
      ) || undefined,
    q:
      str(
        formData,
        "q",
      ) || undefined,
  };

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
    await getSalesReportData(
      params,
    );

  const pdf =
    await buildSalesReportPdf(
      report,
    );

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  await sendEmail({
    to: user.email,
    subject:
      "CanteenCo Sales Report",
    text:
      `Hi ${user.fullName},\n\n` +
      `Attached is your CanteenCo sales report.\n\n` +
      `Transactions: ${report.rows.length}\n` +
      `Total sales: $${report.totalSales.toFixed(2)}\n` +
      `Generated: ${formatBrisbaneDateTime(report.generatedAt)}`,
    attachments: [
      {
        filename:
          `canteenco-sales-report-${date}.pdf`,
        content:
          pdf.toString(
            "base64",
          ),
      },
    ],
  });

  const query =
    salesParamsToQuery(
      params,
    );

  redirect(
    `/admin/sales?${query}&reportEmail=sent`,
  );
}
