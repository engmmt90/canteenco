import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";

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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await requireParent();

  const params = await searchParams;

  const selectedStudentId =
    (params.studentId ?? "").trim();

  const today = new Date();

  const defaultFrom = startOfDay(today);
  const defaultTo = endOfDay(today);

  let fromDate = defaultFrom;
  let toDate = defaultTo;

  if (params.from) {
    const parsedFrom = new Date(
      `${params.from}T00:00:00`,
    );

    if (!Number.isNaN(parsedFrom.getTime())) {
      fromDate = parsedFrom;
    }
  }

  if (params.to) {
    const parsedTo = new Date(
      `${params.to}T23:59:59.999`,
    );

    if (!Number.isNaN(parsedTo.getTime())) {
      toDate = parsedTo;
    }
  }

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId: session.user.id,
      },

      include: {
        students: {
          where: {
            deletedAt: null,
          },

          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayCode: true,
          },

          orderBy: [
            {
              firstName: "asc",
            },
            {
              lastName: "asc",
            },
          ],
        },
      },
    });

  if (!parent) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Purchase History</h1>

          <p className="subtle">
            Parent profile not found.
          </p>

          <Link
            className="secondary"
            href="/parent/dashboard"
          >
            Back to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  const studentIds = parent.students.map(
    (student) => student.id,
  );

  const filteredStudentIds =
    selectedStudentId &&
    studentIds.includes(selectedStudentId)
      ? [selectedStudentId]
      : studentIds;

  const [sales, preOrders] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          studentId: {
            in: filteredStudentIds,
          },

          createdAt: {
            gte: fromDate,
            lte: toDate,
          },

          status: {
            not: "VOIDED",
          },
        },

        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              displayCode: true,
            },
          },

          items: {
            select: {
              productNameSnapshot: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              options: {
                select: {
                  optionName: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.preOrder.findMany({
        where: {
          studentId: {
            in: filteredStudentIds,
          },

          createdAt: {
            gte: fromDate,
            lte: toDate,
          },

          status: {
            not: "CANCELLED",
          },
        },

        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              displayCode: true,
            },
          },

          items: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
              options: {
                select: {
                  optionName: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

  const purchases = [
    ...sales.map((sale) => ({
      id: sale.id,
      number: sale.saleNumber,
      type: "Purchase",
      date: sale.createdAt,
      student: sale.student,
      total: Number(sale.total),

      items: sale.items.map((item) => ({
        name: item.productNameSnapshot,
        quantity: item.quantity,
        options: item.options.map(
          (option) => option.optionName,
        ),
      })),
    })),

    ...preOrders.map((order) => ({
      id: order.id,
      number: order.orderNumber,
      type: "Pre-Order",
      date: order.createdAt,
      student: order.student,
      total: Number(order.total),

      items: order.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        options: item.options.map(
          (option) => option.optionName,
        ),
      })),
    })),
  ].sort(
    (a, b) =>
      b.date.getTime() -
      a.date.getTime(),
  );

  const totalSpent = purchases.reduce(
    (sum, purchase) =>
      sum + purchase.total,
    0,
  );

  return (
    <main className="shell">
      <section className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="brand">
              Purchase History
            </h1>

            <p className="subtle">
              View canteen sales and pre-orders
              for all children or one child.
            </p>
          </div>

          <Link
            className="secondary"
            href="/parent/dashboard"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="divider" />

        <form
          method="get"
          className="panel"
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label
                htmlFor="studentId"
                className="subtle"
              >
                Student
              </label>

              <select
                id="studentId"
                name="studentId"
                className="input"
                defaultValue={
                  selectedStudentId
                }
              >
                <option value="">
                  All Children
                </option>

                {parent.students.map(
                  (student) => (
                    <option
                      value={student.id}
                      key={student.id}
                    >
                      {student.firstName}{" "}
                      {student.lastName} ·{" "}
                      {student.displayCode}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="from"
                className="subtle"
              >
                From
              </label>

              <input
                id="from"
                name="from"
                type="date"
                className="input"
                defaultValue={
                  params.from ??
                  defaultFrom
                    .toISOString()
                    .slice(0, 10)
                }
              />
            </div>

            <div>
              <label
                htmlFor="to"
                className="subtle"
              >
                To
              </label>

              <input
                id="to"
                name="to"
                type="date"
                className="input"
                defaultValue={
                  params.to ??
                  defaultTo
                    .toISOString()
                    .slice(0, 10)
                }
              />
            </div>
          </div>

          <div className="actions-row">
            <button
              className="primary"
              type="submit"
            >
              View History
            </button>

            <Link
              className="secondary"
              href="/parent/purchase-history"
            >
              Today
            </Link>
          </div>
        </form>

        <div className="divider" />

        <div className="grid">
          <div className="stat">
            Purchases

            <strong>
              {purchases.length}
            </strong>
          </div>

          <div className="stat">
            Total spent

            <strong>
              ${totalSpent.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="divider" />

        <h2>
          Purchase History
        </h2>

        <div className="request-list">
          {purchases.map(
            (purchase) => (
              <div
                className="panel"
                key={`${purchase.type}-${purchase.id}`}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>
                      {purchase.student
                        .firstName}{" "}
                      {
                        purchase.student
                          .lastName
                      }
                    </strong>

                    <p className="subtle compact">
                      {
                        purchase.student
                          .displayCode
                      }{" "}
                      · {purchase.type} ·{" "}
                      {purchase.number}
                    </p>

                    <p className="subtle compact">
                      {formatDate(
                        purchase.date,
                      )}
                    </p>
                  </div>

                  <strong>
                    $
                    {purchase.total.toFixed(
                      2,
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: 10,
                  }}
                >
                  {purchase.items.map(
                    (item, index) => (
                      <div
                        key={`${purchase.id}-${index}`}
                        className="subtle compact"
                      >
                        {item.quantity} ×{" "}
                        {item.name}

                        {item.options.length >
                          0 && (
                          <span>
                            {" · "}
                            {item.options.join(
                              ", ",
                            )}
                          </span>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ),
          )}

          {!purchases.length && (
            <div className="panel">
              <p className="subtle">
                No purchases found for
                the selected period.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}