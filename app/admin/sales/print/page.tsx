import Link from "next/link";

import { requireAdmin } from "@/lib/authz";

import {
  formatBrisbaneDateTime,
  getSalesReportData,
  salesParamsToQuery,
  type SalesReportParams,
} from "@/lib/sales-report";

import SalesPrintButton from "./sales-print-button";

export const dynamic =
  "force-dynamic";

type SearchParams =
  SalesReportParams;

function rangeLabel(
  params: SalesReportParams,
) {
  const range =
    params.range ||
    "today";

  if (range === "today") {
    return "Today";
  }

  if (range === "week") {
    return "This Week";
  }

  if (range === "month") {
    return "This Month";
  }

  return `Custom: ${params.from || "-"} to ${params.to || "-"}`;
}

export default async function SalesPrintPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();

  const params =
    await searchParams;

  const report =
    await getSalesReportData(
      params,
    );

  const query =
    salesParamsToQuery(
      params,
    );

  return (
    <main className="content sales-report-print">
      <div className="no-print">
        <div className="page-heading">
          <div>
            <h1 className="brand">
              Sales Report
            </h1>

            <p className="subtle">
              Review the report below, then print.
            </p>
          </div>

          <div className="actions-row">
            <Link
              className="secondary"
              href={`/admin/sales?${query}`}
            >
              Back
            </Link>

            <SalesPrintButton />
          </div>
        </div>
      </div>

      <section
        className="sales-report-sheet"
      >
        <div className="report-head">
          <div className="report-logo-slot">
            {report.logoSchoolId &&
            report.logoData &&
            report.logoMimeType ? (
              <img
                src={`/api/schools/${report.logoSchoolId}/logo`}
                alt="CanteenCo logo"
              />
            ) : null}
          </div>

          <div className="report-title">
            <h1>
              Sales Report
            </h1>

            <strong>
              {report.schoolName ||
                "CanteenCo"}
            </strong>
          </div>

          <div />
        </div>

        <div className="report-meta">
          <span>
            Period:{" "}
            <strong>
              {rangeLabel(
                params,
              )}
            </strong>
          </span>

          <span>
            Generated:{" "}
            <strong>
              {formatBrisbaneDateTime(
                report.generatedAt,
              )}
            </strong>
          </span>

          <span>
            Transactions:{" "}
            <strong>
              {report.rows.length}
            </strong>
          </span>

          <span>
            Total sales:{" "}
            <strong>
              $
              {report.totalSales.toFixed(
                2,
              )}
            </strong>
          </span>
        </div>

        <table>
          <colgroup>
            <col
              style={{
                width: "32px",
              }}
            />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col
              style={{
                width: "80px",
              }}
            />
          </colgroup>

          <thead>
            <tr>
              <th>#</th>
              <th>Sale</th>
              <th>Student</th>
              <th>School</th>
              <th>Cashier</th>
              <th>Status</th>
              <th>Date</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {report.rows.map(
              (
                row,
                index,
              ) => (
                <tr key={row.id}>
                  <td>
                    {index + 1}
                  </td>

                  <td>
                    {row.saleNumber}
                  </td>

                  <td>
                    {row.studentName}
                    <br />
                    <span>
                      {row.studentCode}
                    </span>
                  </td>

                  <td>
                    {row.schoolName}
                  </td>

                  <td>
                    {row.cashierName}
                  </td>

                  <td>
                    {row.status}
                  </td>

                  <td>
                    {formatBrisbaneDateTime(
                      row.createdAt,
                    )}
                  </td>

                  <td
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    $
                    {row.total.toFixed(
                      2,
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {report.rows.length ===
        0 ? (
          <p>
            No sales found for the selected period.
          </p>
        ) : null}
      </section>

      <style>{`
        .sales-report-sheet {
          margin-top: 14px;
        }

        .report-head {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .report-logo-slot {
          justify-self: start;
        }

        .report-logo-slot img {
          display: block;
          max-width: 180px;
          max-height: 70px;
          object-fit: contain;
        }

        .report-title {
          text-align: center;
        }

        .report-title h1 {
          margin: 0;
        }

        .report-meta {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .sales-report-sheet table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
        }

        .sales-report-sheet th,
        .sales-report-sheet td {
          border: 1px solid #ccc;
          padding: 5px;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        .sales-report-sheet th:first-child,
        .sales-report-sheet td:first-child {
          width: 32px;
          text-align: center;
        }

        @media print {
          html,
          body {
            width: 297mm !important;
            min-width: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .sales-report-print {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .sales-report-sheet {
            margin: 0 !important;
          }

          .report-logo-slot img {
            max-width: 145px !important;
            max-height: 52px !important;
          }

          .report-title h1 {
            font-size: 20px !important;
          }

          .report-meta {
            font-size: 8px !important;
            gap: 12px !important;
            margin-bottom: 7px !important;
          }

          .sales-report-sheet table {
            font-size: 7.5px !important;
          }

          .sales-report-sheet th,
          .sales-report-sheet td {
            padding: 3px !important;
            line-height: 1.15 !important;
          }

          .sales-report-sheet thead {
            display: table-header-group !important;
          }

          .sales-report-sheet tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          @page {
            size: A4 landscape;
            margin: 7mm;
          }
        }
      `}</style>
    </main>
  );
}