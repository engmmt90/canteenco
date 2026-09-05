import Link from "next/link";

import { prisma } from "@/lib/prisma";
import {
  adminSchoolScope,
} from "@/lib/admin-scope";

import {
  emailSalesReportToMe,
} from "@/app/actions/admin-sales-report";

import {
  getSalesReportData,
  salesParamsToQuery,
  type SalesReportParams,
} from "@/lib/sales-report";

type SearchParams =
  SalesReportParams & {
    reportEmail?: string;
  };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const {
    session,
    schoolId: forced,
  } =
    await adminSchoolScope();

  const params =
    await searchParams;

  const range =
    params.range ||
    "today";

  const schoolId =
    forced ||
    params.school ||
    undefined;

  const q =
    (params.q || "").trim();

  const report =
    await getSalesReportData({
      ...params,
      school:
        schoolId,
      range,
    });

  const schools =
    session.user.role ===
    "SUPER_ADMIN"
      ? await prisma.school.findMany({
          where: {
            isActive: true,
            deletedAt: null,
          },

          orderBy: {
            name: "asc",
          },
        })
      : [];

  const query =
    salesParamsToQuery({
      ...params,
      school:
        schoolId,
      range,
    });

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Sales
          </h1>

          <p className="subtle">
            View sales and revenue for a selected period.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      {/* DATE RANGE */}

      <section className="panel">
        <h2>
          Sales Period
        </h2>

        <div className="form">
          <div className="actions-row">
            <Link
              className={
                range === "today"
                  ? "primary"
                  : "secondary"
              }
              href={`/admin/sales?${new URLSearchParams({
                range: "today",
                ...(schoolId
                  ? { school: schoolId }
                  : {}),
                ...(q
                  ? { q }
                  : {}),
                ...(params.status
                  ? {
                      status:
                        params.status,
                    }
                  : {}),
              }).toString()}`}
            >
              Today
            </Link>

            <Link
              className={
                range === "week"
                  ? "primary"
                  : "secondary"
              }
              href={`/admin/sales?${new URLSearchParams({
                range: "week",
                ...(schoolId
                  ? { school: schoolId }
                  : {}),
                ...(q
                  ? { q }
                  : {}),
                ...(params.status
                  ? {
                      status:
                        params.status,
                    }
                  : {}),
              }).toString()}`}
            >
              This Week
            </Link>

            <Link
              className={
                range === "month"
                  ? "primary"
                  : "secondary"
              }
              href={`/admin/sales?${new URLSearchParams({
                range: "month",
                ...(schoolId
                  ? { school: schoolId }
                  : {}),
                ...(q
                  ? { q }
                  : {}),
                ...(params.status
                  ? {
                      status:
                        params.status,
                    }
                  : {}),
              }).toString()}`}
            >
              This Month
            </Link>

            <Link
              className={
                range === "custom"
                  ? "primary"
                  : "secondary"
              }
              href={`/admin/sales?${new URLSearchParams({
                range: "custom",
                ...(schoolId
                  ? { school: schoolId }
                  : {}),
                ...(q
                  ? { q }
                  : {}),
                ...(params.status
                  ? {
                      status:
                        params.status,
                    }
                  : {}),
              }).toString()}`}
            >
              Custom
            </Link>
          </div>

          {range === "custom" ? (
            <form
              method="GET"
              className="form"
            >
              <input
                type="hidden"
                name="range"
                value="custom"
              />

              {schoolId ? (
                <input
                  type="hidden"
                  name="school"
                  value={schoolId}
                />
              ) : null}

              {q ? (
                <input
                  type="hidden"
                  name="q"
                  value={q}
                />
              ) : null}

              {params.status ? (
                <input
                  type="hidden"
                  name="status"
                  value={
                    params.status
                  }
                />
              ) : null}

              <div className="two-col">
                <label className="label">
                  From

                  <input
                    className="input"
                    type="date"
                    name="from"
                    defaultValue={
                      params.from ||
                      ""
                    }
                    required
                  />
                </label>

                <label className="label">
                  To

                  <input
                    className="input"
                    type="date"
                    name="to"
                    defaultValue={
                      params.to ||
                      ""
                    }
                    required
                  />
                </label>
              </div>

              <button
                className="primary"
                type="submit"
              >
                Apply Date Range
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {/* SUMMARY */}

      <div
        className="wallet-layout"
        style={{
          marginTop: 18,
        }}
      >
        <section className="panel">
          <p className="subtle compact">
            Total Sales
          </p>

          <h2>
            $
            {report.totalSales.toFixed(
              2,
            )}
          </h2>
        </section>

        <section className="panel">
          <p className="subtle compact">
            Transactions
          </p>

          <h2>
            {report.rows.length}
          </h2>
        </section>
      </div>

      {/* REPORT ACTIONS */}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="page-heading">
          <div>
            <h2>
              Sales Report
            </h2>

            <p className="subtle compact">
              Uses the currently selected period and filters.
            </p>
          </div>

          <div
            className="actions-row"
            style={{
              justifyContent:
                "flex-end",
            }}
          >
            <Link
              className="secondary"
              href={`/admin/sales/print?${query}`}
              target="_blank"
            >
              Print Report
            </Link>

            <a
              className="secondary"
              href={`/api/admin/sales/report.pdf?${query}`}
            >
              Export Report
            </a>

            <form
              action={
                emailSalesReportToMe
              }
            >
              <input
                type="hidden"
                name="range"
                value={range}
              />

              <input
                type="hidden"
                name="from"
                value={
                  params.from ||
                  ""
                }
              />

              <input
                type="hidden"
                name="to"
                value={
                  params.to ||
                  ""
                }
              />

              <input
                type="hidden"
                name="school"
                value={
                  schoolId ||
                  ""
                }
              />

              <input
                type="hidden"
                name="status"
                value={
                  params.status ||
                  ""
                }
              />

              <input
                type="hidden"
                name="q"
                value={q}
              />

              <button
                className="primary"
                type="submit"
              >
                Email PDF to Me
              </button>
            </form>
          </div>
        </div>

        {params.reportEmail ===
        "sent" ? (
          <p
            className="success"
            style={{
              marginTop: 12,
            }}
          >
            Sales report PDF was sent to your admin email.
          </p>
        ) : null}
      </section>

      {/* SEARCH / FILTER */}

      <form
        className="panel actions-row"
        style={{
          marginTop: 18,
        }}
        method="GET"
      >
        <input
          type="hidden"
          name="range"
          value={range}
        />

        {params.from ? (
          <input
            type="hidden"
            name="from"
            value={
              params.from
            }
          />
        ) : null}

        {params.to ? (
          <input
            type="hidden"
            name="to"
            value={params.to}
          />
        ) : null}

        {session.user.role ===
        "SUPER_ADMIN" ? (
          <select
            className="input"
            name="school"
            defaultValue={
              schoolId ||
              ""
            }
          >
            <option value="">
              All schools
            </option>

            {schools.map(
              (school) => (
                <option
                  key={school.id}
                  value={school.id}
                >
                  {school.name}
                </option>
              ),
            )}
          </select>
        ) : null}

        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Sale, student or 3C-001"
        />

        <select
          className="input"
          name="status"
          defaultValue={
            params.status ||
            ""
          }
        >
          <option value="">
            All statuses
          </option>

          <option value="COMPLETED">
            COMPLETED
          </option>

          <option value="REFUNDED">
            REFUNDED
          </option>

          <option value="VOIDED">
            VOIDED
          </option>
        </select>

        <button className="primary">
          Search
        </button>
      </form>

      {/* SALES LIST */}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {report.rows.map(
            (sale) => (
              <Link
                className="list-row"
                href={`/admin/sales/${sale.id}`}
                key={sale.id}
              >
                <div>
                  <strong>
                    {sale.saleNumber}
                  </strong>

                  <div className="subtle compact">
                    {sale.studentName}
                    {" · "}
                    {sale.studentCode}
                    {" · "}
                    {sale.schoolName}
                    {" · "}
                    {sale.cashierName}
                  </div>
                </div>

                <div>
                  <strong>
                    $
                    {sale.total.toFixed(
                      2,
                    )}
                  </strong>

                  <div className="subtle compact">
                    {sale.status}
                    {" · "}
                    {sale.createdAt.toLocaleString(
                      "en-AU",
                      {
                        timeZone:
                          "Australia/Brisbane",
                      },
                    )}
                  </div>
                </div>
              </Link>
            ),
          )}

          {report.rows.length ===
          0 ? (
            <p className="subtle">
              No sales found for the selected period.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}