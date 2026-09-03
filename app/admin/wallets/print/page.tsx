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
        style={{
          marginTop: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 16,
          }}
        >
          {report.schoolId &&
          report.logoData &&
          report.logoMimeType ? (
            <img
              src={`/api/schools/${report.schoolId}/logo`}
              alt={`${report.schoolName ?? "School"} logo`}
              style={{
                display: "block",
                maxWidth: 180,
                maxHeight: 80,
                objectFit: "contain",
              }}
            />
          ) : null}

          <div>
            <h1
              style={{
                margin: 0,
              }}
            >
              Wallet Balance Report
            </h1>

            {report.schoolName ? (
              <p
                style={{
                  margin:
                    "4px 0 0",
                  fontWeight: 700,
                }}
              >
                {report.schoolName}
              </p>
            ) : (
              <p
                style={{
                  margin:
                    "4px 0 0",
                  fontWeight: 700,
                }}
              >
                CanteenCo
              </p>
            )}
          </div>
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
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .wallet-report-print {
            max-width: none !important;
            padding: 0 !important;
          }

          @page {
            size: A4 landscape;
            margin: 12mm;
          }
        }
      `}</style>
    </main>
  );
}