import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireAdmin } from "@/lib/authz";

import {
  buildSalesReportPdf,
  getSalesReportData,
  type SalesReportParams,
} from "@/lib/sales-report";

export const dynamic =
  "force-dynamic";

export async function GET(
  req: NextRequest,
) {
  await requireAdmin();

  const p =
    req.nextUrl.searchParams;

  const params: SalesReportParams = {
    range:
      p.get("range") ||
      "today",
    from:
      p.get("from") ||
      undefined,
    to:
      p.get("to") ||
      undefined,
    school:
      p.get("school") ||
      undefined,
    status:
      p.get("status") ||
      undefined,
    q:
      p.get("q") ||
      undefined,
  };

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

  return new NextResponse(
    new Uint8Array(pdf),
    {
      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="canteenco-sales-report-${date}.pdf"`,

        "Cache-Control":
          "no-store",
      },
    },
  );
}
