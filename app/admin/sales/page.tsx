import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminSchoolScope } from "@/lib/admin-scope";

type SearchParams = {
  q?: string;
  status?: string;
  school?: string;
  range?: string;
  from?: string;
  to?: string;
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);

  const day = result.getDay();

  const difference =
    day === 0 ? -6 : 1 - day;

  result.setDate(
    result.getDate() + difference,
  );

  return result;
}

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
}

function parseDateInput(
  value?: string,
  end = false,
) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return undefined;
  }

  return end
    ? new Date(
        year,
        month - 1,
        day,
        23,
        59,
        59,
        999,
      )
    : new Date(
        year,
        month - 1,
        day,
        0,
        0,
        0,
        0,
      );
}

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

  const schoolId =
    forced ||
    params.school ||
    undefined;

  const q =
    (params.q || "").trim();

  const range =
    params.range || "today";

  const now = new Date();

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (range === "today") {
    dateFrom = startOfDay(now);
    dateTo = endOfDay(now);
  }

  if (range === "week") {
    dateFrom = startOfWeek(now);
    dateTo = endOfDay(now);
  }

  if (range === "month") {
    dateFrom =
      startOfMonth(now);

    dateTo =
      endOfDay(now);
  }

  if (range === "custom") {
    dateFrom =
      parseDateInput(
        params.from,
      );

    dateTo =
      parseDateInput(
        params.to,
        true,
      );
  }

  const where: any = {
    ...(schoolId
      ? { schoolId }
      : {}),

    ...(params.status
      ? {
          status:
            params.status,
        }
      : {}),

    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom
              ? {
                  gte: dateFrom,
                }
              : {}),

            ...(dateTo
              ? {
                  lte: dateTo,
                }
              : {}),
          },
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              saleNumber: {
                contains: q,
                mode: "insensitive",
              },
            },

            {
              student: {
                OR: [
                  {
                    displayCode: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },

                  {
                    firstName: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },

                  {
                    lastName: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [
    rows,
    schools,
  ] =
    await Promise.all([
      prisma.sale.findMany({
        where,

        include: {
          student: true,
          school: true,
          cashier: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 200,
      }),

      prisma.school.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },

        orderBy: {
          name: "asc",
        },
      }),
    ]);

  const totalSales =
    rows.reduce(
      (sum, sale) =>
        sum + Number(sale.total),
      0,
    );

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Sales
          </h1>

          <p className="subtle">
            View sales and revenue
            for a selected period.
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

        <form
          className="form"
          method="GET"
        >
          {schoolId && (
            <input
              type="hidden"
              name="school"
              value={schoolId}
            />
          )}

          {q && (
            <input
              type="hidden"
              name="q"
              value={q}
            />
          )}

          {params.status && (
            <input
              type="hidden"
              name="status"
              value={
                params.status
              }
            />
          )}

          <div className="actions-row">
            <button
              className={
                range === "today"
                  ? "primary"
                  : "secondary"
              }
              name="range"
              value="today"
            >
              Today
            </button>

            <button
              className={
                range === "week"
                  ? "primary"
                  : "secondary"
              }
              name="range"
              value="week"
            >
              This Week
            </button>

            <button
              className={
                range === "month"
                  ? "primary"
                  : "secondary"
              }
              name="range"
              value="month"
            >
              This Month
            </button>

            <button
              className={
                range === "custom"
                  ? "primary"
                  : "secondary"
              }
              name="range"
              value="custom"
            >
              Custom
            </button>
          </div>

          {range ===
            "custom" && (
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
                />
              </label>

              <button
                className="primary"
                type="submit"
              >
                Apply Date Range
              </button>
            </div>
          )}
        </form>
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
            {totalSales.toFixed(
              2,
            )}
          </h2>
        </section>

        <section className="panel">
          <p className="subtle compact">
            Transactions
          </p>

          <h2>
            {rows.length}
          </h2>
        </section>
      </div>

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

        {params.from && (
          <input
            type="hidden"
            name="from"
            value={
              params.from
            }
          />
        )}

        {params.to && (
          <input
            type="hidden"
            name="to"
            value={params.to}
          />
        )}

        {session.user.role ===
          "SUPER_ADMIN" ? (
          <select
            className="input"
            name="school"
            defaultValue={
              schoolId || ""
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
          {rows.map((sale) => (
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
                  {
                    sale.student
                      .firstName
                  }{" "}
                  {
                    sale.student
                      .lastName
                  }

                  {" · "}

                  {
                    sale.student
                      .displayCode
                  }

                  {" · "}

                  {
                    sale.school
                      .name
                  }

                  {" · "}

                  {
                    sale.cashier
                      .fullName
                  }
                </div>
              </div>

              <div>
                <strong>
                  $
                  {Number(
                    sale.total,
                  ).toFixed(2)}
                </strong>

                <div className="subtle compact">
                  {
                    sale.status
                  }

                  {" · "}

                  {sale.createdAt.toLocaleString(
                    "en-AU",
                  )}
                </div>
              </div>
            </Link>
          ))}

          {rows.length ===
            0 && (
            <p className="subtle">
              No sales found for
              the selected period.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}