import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { adminSchoolScope } from "@/lib/admin-scope";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function money(value: unknown) {
  return `$${Number(value).toFixed(2)}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    school?: string;
    q?: string;
    paymentMethod?: string;
  }>;
}) {
  const {
    session,
    schoolId: forcedSchool,
  } = await adminSchoolScope();

  const params = await searchParams;

  const schoolId =
    forcedSchool ||
    params.school ||
    undefined;

  const q =
    (params.q || "").trim();

  const paymentMethod =
    params.paymentMethod || "";

  const today = startOfToday();

  const saleWhere: any = {
    createdAt: {
      gte: today,
    },
    status: "COMPLETED",
    ...(schoolId
      ? { schoolId }
      : {}),
    ...(paymentMethod
      ? { paymentMethod }
      : {}),
  };

  const preorderWhere: any = {
    pickupDate: {
      gte: today,
      lt: new Date(
        today.getTime() +
          86400000,
      ),
    },
    ...(schoolId
      ? { schoolId }
      : {}),
  };

  const studentWhere: any = {
    status: "ACTIVE",
    deletedAt: null,
    ...(schoolId
      ? { schoolId }
      : {}),
    ...(q
      ? {
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
        }
      : {}),
  };

  const recentSaleWhere: any = {
    ...saleWhere,
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
                is: {
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
            },
          ],
        }
      : {}),
  };

  const [
    salesAgg,
    salesCount,
    walletAgg,
    cashAgg,
    cardAgg,
    preorders,
    students,
    schools,
    negativeWallets,
    walletBalanceAgg,
    recentSales,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: {
        total: true,
      },
    }),
    prisma.sale.count({
      where: saleWhere,
    }),
    prisma.sale.aggregate({
      where: {
        ...saleWhere,
        paymentMethod: "WALLET",
      },
      _sum: {
        total: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        ...saleWhere,
        paymentMethod: "CASH",
      },
      _sum: {
        total: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        ...saleWhere,
        paymentMethod: "CARD",
      },
      _sum: {
        total: true,
      },
    }),
    prisma.preOrder.count({
      where: preorderWhere,
    }),
    prisma.student.count({
      where: studentWhere,
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
    prisma.wallet.count({
      where: {
        balance: {
          lt: 0,
        },
        ...(schoolId
          ? {
              parent: {
                students: {
                  some: {
                    schoolId,
                    status: "ACTIVE",
                  },
                },
              },
            }
          : {}),
      },
    }),
    prisma.wallet.aggregate({
      where: schoolId
        ? {
            parent: {
              students: {
                some: {
                  schoolId,
                  status: "ACTIVE",
                },
              },
            },
          }
        : {},
      _sum: {
        balance: true,
      },
    }),
    prisma.sale.findMany({
      where: recentSaleWhere,
      include: {
        student: true,
        school: true,
        cashier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  const exportParams =
    new URLSearchParams();

  if (schoolId) {
    exportParams.set(
      "school",
      schoolId,
    );
  }

  if (paymentMethod) {
    exportParams.set(
      "paymentMethod",
      paymentMethod,
    );
  }

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Reports
          </h1>
          <p className="subtle">
            Operational view across sales, wallets,
            students and pre-orders.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      <form
        className="panel actions-row"
        style={{ marginBottom: 18 }}
      >
        {session.user.role ===
        "SUPER_ADMIN" ? (
          <select
            className="input"
            name="school"
            defaultValue={schoolId || ""}
          >
            <option value="">
              All schools
            </option>
            {schools.map((school) => (
              <option
                key={school.id}
                value={school.id}
              >
                {school.name}
              </option>
            ))}
          </select>
        ) : null}

        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Sale, student name or 3C-001"
        />

        <select
          className="input"
          name="paymentMethod"
          defaultValue={paymentMethod}
        >
          <option value="">
            All payment methods
          </option>
          <option value="WALLET">
            Wallet
          </option>
          <option value="CASH">
            Cash
          </option>
          <option value="CARD">
            Card
          </option>
        </select>

        <button className="primary">
          Apply
        </button>

        <a
          className="secondary"
          href={`/api/admin/reports/sales.csv${
            exportParams.toString()
              ? `?${exportParams.toString()}`
              : ""
          }`}
        >
          Export Sales CSV
        </a>
      </form>

      <div className="grid">
        <div className="stat">
          Today’s sales
          <strong>
            {money(
              salesAgg._sum.total || 0,
            )}
          </strong>
          <span>
            {salesCount} transactions
          </span>
        </div>

        <div className="stat">
          Wallet sales
          <strong>
            {money(
              walletAgg._sum.total || 0,
            )}
          </strong>
        </div>

        <div className="stat">
          Cash sales
          <strong>
            {money(
              cashAgg._sum.total || 0,
            )}
          </strong>
        </div>

        <div className="stat">
          Card sales
          <strong>
            {money(
              cardAgg._sum.total || 0,
            )}
          </strong>
        </div>

        <div className="stat">
          Pre-orders today
          <strong>{preorders}</strong>
        </div>

        <div className="stat">
          Active students
          <strong>{students}</strong>
        </div>

        <div className="stat">
          Negative wallets
          <strong>
            {negativeWallets}
          </strong>
        </div>

        <div className="stat">
          Total wallet balance
          <strong>
            {money(
              walletBalanceAgg._sum
                .balance || 0,
            )}
          </strong>
        </div>
      </div>

      <section
        className="panel"
        style={{ marginTop: 18 }}
      >
        <h2>Recent sales</h2>

        <div className="request-list">
          {recentSales.length === 0 ? (
            <p className="subtle">
              No matching sales.
            </p>
          ) : (
            recentSales.map((sale) => (
              <div
                className="list-row"
                key={sale.id}
              >
                <div>
                  <strong>
                    {sale.student
                      ? `${sale.student.firstName} ${sale.student.lastName} · ${sale.student.displayCode}`
                      : "Guest / Walk-in"}
                  </strong>

                  <div className="subtle compact">
                    {sale.school.name} ·{" "}
                    {sale.cashier.fullName} ·{" "}
                    {sale.paymentMethod} ·{" "}
                    {sale.createdAt.toLocaleString(
                      "en-AU",
                    )}
                  </div>
                </div>

                <strong>
                  {money(sale.total)}
                </strong>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
