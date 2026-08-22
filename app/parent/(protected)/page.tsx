import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { updateStudentDailyLimit } from "@/app/actions/parent-students";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";

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
        <h1 className="brand">
          CanteenCo
        </h1>

        <h2>
          Family Wallet
        </h2>

        <p className="subtle">
          Signed in as{" "}
          {session.user.name ??
            session.user.email}
          .
        </p>

        <div className="grid">
          <div className="stat">
            Current balance

            <strong>
              $
              {Number(
                parent?.wallet?.balance ??
                  0,
              ).toFixed(2)}
            </strong>
          </div>

          <div className="stat">
            Children

            <strong>
              {parent?.students.length ??
                0}
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

          <Link
            className="secondary"
            href="/parent/contact"
          >
            Contact Us
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
                  (sum, sale) =>
                    sum +
                    Number(
                      sale.total,
                    ),
                  0,
                );

              const preOrdersTotal =
                student.preOrders.reduce(
                  (sum, order) =>
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

              return (
                <div
                  className="panel request-card"
                  key={student.id}
                >
                  <div className="request-head">
                    <div>
                      <strong>
                        {
                          student.firstName
                        }{" "}
                        {
                          student.lastName
                        }
                      </strong>

                      <p className="subtle compact">
                        {
                          student.school
                            .name
                        }{" "}
                        ·{" "}
                        {
                          student.displayCode
                        }{" "}
                        · Grade{" "}
                        {student.grade}
                        {student.classSection
                          ? ` ${student.classSection}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="student-summary">
                    <div className="student-row">
                      <span>
                        Spent today
                      </span>

                      <strong>
                        $
                        {spentToday.toFixed(
                          2,
                        )}
                      </strong>
                    </div>

                    <div className="student-row">
                      <span>
                        Daily spending
                        limit
                      </span>

                      <strong>
                        {dailyLimit ===
                        null
                          ? "No limit"
                          : `$${dailyLimit.toFixed(
                              2,
                            )}`}
                      </strong>
                    </div>

                    <div className="student-row">
                      <span>
                        Remaining today
                      </span>

                      <strong>
                        {remainingToday ===
                        null
                          ? "Unlimited"
                          : `$${remainingToday.toFixed(
                              2,
                            )}`}
                      </strong>
                    </div>
                  </div>

                  <div className="divider" />

                  <form
                    action={
                      updateStudentDailyLimit
                    }
                    className="form"
                  >
                    <input
                      type="hidden"
                      name="studentId"
                      value={
                        student.id
                      }
                    />

                    <label className="label">
                      Daily spending
                      limit

                      <input
                        className="input"
                        type="number"
                        name="dailySpendLimit"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Leave empty for no limit"
                        defaultValue={
                          dailyLimit ===
                          null
                            ? ""
                            : dailyLimit.toFixed(
                                2,
                              )
                        }
                      />
                    </label>

                    <p className="subtle compact">
                      Leave this field
                      empty to allow
                      unlimited daily
                      spending.
                    </p>

                    <button
                      className="primary"
                      type="submit"
                    >
                      Save Daily Limit
                    </button>
                  </form>
                </div>
              );
            },
          )}

          {!parent?.students.length ? (
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

          <Link
            className="secondary"
            href="/parent/contact"
          >
            Contact Us
          </Link>
        </div>

        <div
          style={{
            height: 12,
          }}
        />

        <form action={logout}>
          <button
            className="secondary"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}