import { NextResponse } from "next/server";

import {
  buildWalletReportPdf,
  getWalletReportData,
} from "@/lib/wallet-report";
import { requireAdmin } from "@/lib/authz";

export const dynamic =
  "force-dynamic";

export async function GET() {
  await requireAdmin();

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

  return new NextResponse(
    new Uint8Array(pdf),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/pdf",
        "Content-Disposition":
          `attachment; filename="canteenco-wallet-report-${date}.pdf"`,
        "Cache-Control":
          "no-store",
      },
    },
  );
}
