import Link from "next/link";

import {
  formatBrisbaneDateTime,
  getWalletReportData,
} from "@/lib/wallet-report";
import { requireAdmin } from "@/lib/authz";
import WalletPrintButton from "./wallet-print-button";

export const dynamic =
  "force-dynamic";

export default async function WalletPrintPage() {
  await requireAdmin();

  const report =
    await getWalletReportData();

  return (
    <main className="content wallet-report-print">
      <div className="no-print">
        <div className="page-heading">
          <div>
            <h1 className="brand">
              Wallet Balance Report
            </h1>

            <p className="subtle">
              Review the report below, then print.
            </p>
          </div>

          <div className="actions-row">
            <Link
              className="secondary"
              href="/admin/wallets"
            >
              Back
            </Link>

            <WalletPrintButton />
          </div>
        </div>
      </div>

      <section
        className="wallet-report-sheet"
        style={{
          marginTop: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr auto 1fr",
            alignItems: "center",
            gap: 18,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              justifySelf: "start",
            }}
          >
            {report.logoSchoolId &&
            report.logoData &&
            report.logoMimeType ? (
              <img
                src={`/api/schools/${report.logoSchoolId}/logo`}
                alt={`${report.schoolName ?? "School"} logo`}
                style={{
                  display: "block",
                  maxWidth: 180,
                  maxHeight: 80,
                  objectFit: "contain",
                }}
              />
            ) : null}
          </div>

          <div
            style={{
              textAlign: "center",
              justifySelf: "center",
            }}
          >
            <h1
              style={{
                margin: 0,
              }}
            >
              Wallet Balance Report
            </h1>

            <p
              style={{
                margin:
                  "4px 0 0",
                fontWeight: 700,
              }}
            >
              {report.schoolName ??
                "CanteenCo"}
            </p>
          </div>

          <div />
        </div>

        <p>
          Generated:{" "}
          {formatBrisbaneDateTime(
            report.generatedAt,
          )}
        </p>

        <p>
          Wallets:{" "}
          <strong>
            {report.rows.length}
          </strong>
          {" · "}
          Total balance:{" "}
          <strong>
            $
            {report.totalBalance.toFixed(
              2,
            )}
          </strong>
        </p>

        <table
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
            marginTop: 18,
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              {[
                "#",
                "Parent",
                "Email",
                "Students",
                "Status",
                "Balance",
              ].map(
                (heading) => (
                  <th
                    key={
                      heading
                    }
                    style={{
                      border:
                        "1px solid #bbb",
                      padding: 7,
                      textAlign:
                        "left",
                    }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {report.rows.map(
              (
                row,
                index,
              ) => (
                <tr
                  key={
                    row.walletId
                  }
                >
                  <td
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 7,
                    }}
                  >
                    {index + 1}
                  </td>

                  <td
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 7,
                    }}
                  >
                    {
                      row.parentName
                    }
                  </td>

                  <td
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 7,
                    }}
                  >
                    {row.email}
                  </td>

                  <td
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 7,
                    }}
                  >
                    {
                      row.students
                    }
                  </td>

                  <td
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 7,
                    }}
                  >
                    {
                      row.status
                    }
                  </td>

                  <td
                    style={{
                      border:
                        "1px solid #ccc",
                      padding: 7,
                      textAlign:
                        "right",
                    }}
                  >
                    $
                    {row.balance.toFixed(
                      2,
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <style>{`
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

          .wallet-report-print {
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .wallet-report-sheet {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .wallet-report-sheet h1 {
            font-size: 20px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }

          .wallet-report-sheet p {
            font-size: 9px !important;
            line-height: 1.2 !important;
            margin: 4px 0 !important;
          }

          .wallet-report-sheet table {
            width: 100% !important;
            table-layout: fixed !important;
            margin-top: 8px !important;
            font-size: 8px !important;
          }

          .wallet-report-sheet th,
          .wallet-report-sheet td {
            padding: 3px 4px !important;
            line-height: 1.15 !important;
            vertical-align: top !important;
            overflow-wrap: anywhere !important;
          }

          .wallet-report-sheet thead {
            display: table-header-group !important;
          }

          .wallet-report-sheet tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .wallet-report-sheet img {
            max-width: 150px !important;
            max-height: 55px !important;
            object-fit: contain !important;
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
