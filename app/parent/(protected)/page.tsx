import Link from "next/link";

import {
  logout,
} from "@/app/actions/auth";

import {
  prisma,
} from "@/lib/prisma";

import {
  requireParent,
} from "@/lib/authz";

import DailyLimitModal from "./daily-limit-modal";

function startOfToday() {
  const date = new Date();

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date;
}

function endOfToday() {
  const date = new Date();

  date.setHours(
    24,
    0,
    0,
    0,
  );

  return date;
}

export default async function ParentDashboardPage() {
  const session =
    await requireParent();

  const today =
    startOfToday();

  const tomorrow =
    endOfToday();

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId:
          session.user.id,
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

                status:
                  "COMPLETED",
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
              firstName:
                "asc",
            },

            {
              lastName:
                "asc",
            },
          ],
        },
      },
    });

  return (
    <main className="shell">
      <section className="card registration-card">
        <h1 className="brand">
          CanteenCo
        </h1>

        <h2>
          Family Wallet
        </h2>

        <p className="subtle">
          Signed in as{" "}
          {session.user.name ??
            session.user.email}.
        </p>

        <div className="grid">
          <div className="stat">
            Current balance

            <strong>
              $
              {Number(
                parent?.wallet
                  ?.balance ?? 0,
              ).toFixed(2)}
            </strong>
          </div>

          <div className="stat">
            Children

            <strong>
              {parent?.students
                .length ?? 0}
            </strong>
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

        <h2 className="section-title">
          Children
        </h2>

        <div className="request-list">
          {parent?.students.map(
            (student) => {
              const salesTotal =
                student.sales.reduce(
                  (
                    sum,
                    sale,
                  ) =>
                    sum +
                    Number(
                      sale.total,
                    ),
                  0,
                );

              const preOrdersTotal =
                student.preOrders.reduce(
                  (
                    sum,
                    order,
                  ) =>
                    sum +
                    Number(
                      order.total,
                    ),
                  0,
                );

              const spentToday =
                salesTotal +
                preOrdersTotal;

              const dailyLimit =
                student.dailySpendLimit ===
                null
                  ? null
                  : Number(
                      student.dailySpendLimit,
                    );

              const remainingToday =
                dailyLimit === null
                  ? null
                  : Math.max(
                      0,
                      dailyLimit -
                        spentToday,
                    );

              const lowRemaining =
                remainingToday !== null &&
                remainingToday < 5;

              return (
                <div
                  className="panel request-card"
                  key={
                    student.id
                  }
                  style={{
                    padding: 16,
                  }}
                >
                  <div
                    className="request-head"
                    style={{
                      alignItems:
                        "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {
                          student.firstName
                        }{" "}
                        {
                          student.lastName
                        }
                      </strong>

                      <p
                        className="subtle compact"
                        style={{
                          marginBottom: 0,
                        }}
                      >
                        {
                          student
                            .school
                            .name
                        }{" "}
                        ·{" "}
                        {
                          student.displayCode
                        }{" "}
                        · Grade{" "}
                        {
                          student.grade
                        }
                        {student.classSection
                          ? ` ${student.classSection}`
                          : ""}
                      </p>
                    </div>

                    <DailyLimitModal
                      studentId={
                        student.id
                      }
                      studentName={`${student.firstName} ${student.lastName}`}
                      dailyLimit={
                        dailyLimit
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <div
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #e5e7eb",
                        borderRadius: 10,
                        minHeight: 58,
                      }}
                    >
                      <div
                        className="subtle"
                        style={{
                          fontSize: 13,
                          lineHeight: 1.2,
                          marginBottom: 4,
                        }}
                      >
                        Spent today
                      </div>

                      <strong
                        style={{
                          fontSize: 16,
                        }}
                      >
                        $
                        {spentToday.toFixed(
                          2,
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #e5e7eb",
                        borderRadius: 10,
                        minHeight: 58,
                      }}
                    >
                      <div
                        className="subtle"
                        style={{
                          fontSize: 13,
                          lineHeight: 1.2,
                          marginBottom: 4,
                        }}
                      >
                        Daily spending limit
                      </div>

                      <strong
                        style={{
                          fontSize: 16,
                        }}
                      >
                        {dailyLimit ===
                        null
                          ? "No limit"
                          : `$${dailyLimit.toFixed(
                              2,
                            )}`}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          lowRemaining
                            ? "1px solid #fecaca"
                            : "1px solid #e5e7eb",
                        borderRadius: 10,
                        minHeight: 58,
                      }}
                    >
                      <div
                        className="subtle"
                        style={{
                          fontSize: 13,
                          lineHeight: 1.2,
                          marginBottom: 4,
                          color:
                            lowRemaining
                              ? "#dc2626"
                              : undefined,
                          fontWeight:
                            lowRemaining
                              ? 700
                              : undefined,
                        }}
                      >
                        Remaining today
                      </div>

                      <strong
                        style={{
                          fontSize: 16,
                          color:
                            lowRemaining
                              ? "#dc2626"
                              : undefined,
                        }}
                      >
                        {remainingToday ===
                        null
                          ? "Unlimited"
                          : `$${remainingToday.toFixed(
                              2,
                            )}`}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            },
          )}

          {!parent?.students
            .length ? (
            <p className="subtle">
              No approved students
              are linked to this
              account yet.
            </p>
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