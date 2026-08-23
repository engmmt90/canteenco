import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";
import DailyLimitModal from "./daily-limit-modal";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  return date;
}

export default async function ParentDashboardPage() {
  const session = await requireParent();

  const today = startOfToday();
  const tomorrow = endOfToday();

  const parent = await prisma.parentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    include: {
      wallet: true,
      students: {
        where: {
          deletedAt: null,
        },
        include: {
          school: {
            select: {
              name: true,
            },
          },
          sales: {
            where: {
              createdAt: {
                gte: today,
                lt: tomorrow,
              },
              status: "COMPLETED",
            },
            select: {
              total: true,
            },
          },
          preOrders: {
            where: {
              createdAt: {
                gte: today,
                lt: tomorrow,
              },
              status: {
                in: [
                  "CONFIRMED",
                  "PREPARING",
                  "READY",
                  "PICKED_UP",
                ],
              },
            },
            select: {
              total: true,
            },
          },
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

  return (
    <main className="shell">
      <section className="card registration-card">
        <h1 className="brand">CanteenCo</h1>

        <h2>Family Wallet</h2>

        <p className="subtle">
          Signed in as {session.user.name ?? session.user.email}.
        </p>

        <div className="grid">
          <div className="stat">
            Current balance
            <strong>
              ${Number(parent?.wallet?.balance ?? 0).toFixed(2)}
            </strong>
          </div>

          <div className="stat">
            Children
            <strong>{parent?.students.length ?? 0}</strong>
          </div>
        </div>

        <div className="divider" />

        <div className="actions-row">
          <Link
            className="primary"
            href="/parent/wallet"
          >
            Wallet / Top Up
          </Link>

          <Link
            className="secondary"
            href="/parent/preorders"
          >
            Pre-Orders
          </Link>
        </div>

        <div className="divider" />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2
            className="section-title"
            style={{
              margin: 0,
            }}
          >
            Children
          </h2>

          <Link
            className="secondary"
            href="/parent/add-student"
          >
            + Add Student
          </Link>
        </div>

        <div className="request-list">
          {parent?.students.map((student) => {
            const salesTotal = student.sales.reduce(
              (sum, sale) =>
                sum + Number(sale.total),
              0,
            );

            const preOrdersTotal =
              student.preOrders.reduce(
                (sum, order) =>
                  sum + Number(order.total),
                0,
              );

            const spentToday =
              salesTotal + preOrdersTotal;

            const dailyLimit =
              student.dailySpendLimit === null
                ? null
                : Number(student.dailySpendLimit);

            const remainingToday =
              dailyLimit === null
                ? null
                : Math.max(
                    0,
                    dailyLimit - spentToday,
                  );

            const remainingLow =
              remainingToday !== null &&
              remainingToday < 5;

            return (
              <div
                className="panel request-card"
                key={student.id}
                style={{
                  padding: 16,
                }}
              >
                <div
                  className="request-head"
                  style={{
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>
                      {student.firstName}{" "}
                      {student.lastName}
                    </strong>

                    <p
                      className="subtle compact"
                      style={{
                        marginBottom: 0,
                      }}
                    >
                      {student.school.name} ·{" "}
                      {student.displayCode} · Grade{" "}
                      {student.grade}
                      {student.classSection
                        ? ` ${student.classSection}`
                        : ""}
                    </p>
                  </div>

                  <DailyLimitModal
                    studentId={student.id}
                    studentName={`${student.firstName} ${student.lastName}`}
                    dailyLimit={dailyLimit}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <div
                    className="student-row"
                    style={{
                      padding: "10px 12px",
                      minHeight: 72,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                      }}
                    >
                      Spent today
                    </span>

                    <strong
                      style={{
                        fontSize: 18,
                        marginTop: 2,
                      }}
                    >
                      ${spentToday.toFixed(2)}
                    </strong>
                  </div>

                  <div
                    className="student-row"
                    style={{
                      padding: "10px 12px",
                      minHeight: 72,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                      }}
                    >
                      Daily spending limit
                    </span>

                    <strong
                      style={{
                        fontSize: 18,
                        marginTop: 2,
                      }}
                    >
                      {dailyLimit === null
                        ? "No limit"
                        : `$${dailyLimit.toFixed(2)}`}
                    </strong>
                  </div>

                  <div
                    className="student-row"
                    style={{
                      padding: "10px 12px",
                      minHeight: 72,
                      borderColor: remainingLow
                        ? "#fecaca"
                        : "#e5e7eb",
                      background: remainingLow
                        ? "#fff7f7"
                        : "#fafafa",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: remainingLow
                          ? "#b91c1c"
                          : "#6b7280",
                        fontWeight: remainingLow
                          ? 700
                          : 500,
                      }}
                    >
                      Remaining today
                    </span>

                    <strong
                      style={{
                        fontSize: 18,
                        marginTop: 2,
                        color: remainingLow
                          ? "#b91c1c"
                          : "#111827",
                      }}
                    >
                      {remainingToday === null
                        ? "Unlimited"
                        : `$${remainingToday.toFixed(2)}`}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}

          {!parent?.students.length ? (
            <div
              className="panel"
              style={{
                textAlign: "center",
                padding: 24,
              }}
            >
              <p className="subtle">
                No approved students are linked
                to this account yet.
              </p>

              <Link
                className="primary"
                href="/parent/add-student"
              >
                + Add Student
              </Link>
            </div>
          ) : null}
        </div>

        <div className="divider" />

        <div className="actions-row">
          <Link
            className="secondary"
            href="/parent/notifications"
          >
            Notifications
          </Link>

          <Link
            className="secondary"
            href="/parent/settings/notifications"
          >
            Notification Preferences
          </Link>
        </div>

        <div
          style={{
            height: 12,
          }}
        />

        <div className="actions-row">
          <Link
            className="secondary"
            href="/parent/contact"
          >
            Contact Us
          </Link>

          <form action={logout}>
            <button
              className="secondary"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}