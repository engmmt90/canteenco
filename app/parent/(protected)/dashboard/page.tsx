import Link from "next/link";
import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ParentDashboardPage() {
  const session = await requireParent();

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId: session.user.id,
      },

      include: {
        wallet: true,

        students: {
          where: {
            deletedAt: null,
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

  const balance = parent?.wallet
    ? Number(
        parent.wallet.balance,
      ).toFixed(2)
    : "0.00";

  const activePreOrders =
    parent?.wallet
      ? await prisma.preOrder.count({
          where: {
            walletId:
              parent.wallet.id,

            status: {
              in: [
                "CONFIRMED",
                "PREPARING",
                "READY",
              ],
            },
          },
        })
      : 0;

  const studentIds =
    parent?.students.map(
      (student) => student.id,
    ) ?? [];

  const today = new Date();
  const startOfToday =
    new Date(today);

  startOfToday.setHours(
    0,
    0,
    0,
    0,
  );

  const startOfTomorrow =
    new Date(startOfToday);

  startOfTomorrow.setDate(
    startOfTomorrow.getDate() + 1,
  );

  const salesToday =
    studentIds.length > 0
      ? await prisma.sale.aggregate({
          where: {
            studentId: {
              in: studentIds,
            },

            createdAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },

            status: {
              not: "VOIDED",
            },
          },

          _sum: {
            total: true,
          },
        })
      : null;

  const spentToday = Number(
    salesToday?._sum.total ?? 0,
  ).toFixed(2);

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Family Dashboard
          </h1>

          <p className="subtle">
            Welcome back. Your family wallet
            is shared by all approved children.
          </p>
        </div>

        <Link
          className="primary"
          href="/parent/wallet"
        >
          Top Up Wallet
        </Link>
      </div>

      <div className="grid">
        <Link
          className="stat"
          href="/parent/wallet"
        >
          Available balance

          <strong>
            ${balance}
          </strong>
        </Link>

        <div className="stat">
          Children

          <strong>
            {parent?.students.length ?? 0}
          </strong>
        </div>

        <Link
          className="stat"
          href="/parent/preorders"
        >
          Pre-orders

          <strong>
            {activePreOrders}
          </strong>
        </Link>

        <Link
          className="stat"
          href="/parent/purchase-history"
        >
          Spent today

          <strong>
            ${spentToday}
          </strong>
        </Link>
      </div>

      <div
        style={{
          height: 18,
        }}
      />

      <section className="panel">
        <h2>Children</h2>

        {parent?.students.length ? (
          <div className="student-summary">
            {parent.students.map(
              (student) => (
                <div
                  className="student-row"
                  key={student.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection:
                        "column",
                      minWidth: 0,
                    }}
                  >
                    <strong>
                      {student.firstName}{" "}
                      {student.lastName}
                    </strong>

                    <span>
                      {student.displayCode} · Grade{" "}
                      {student.grade}
                      {student.classSection ?? ""}
                    </span>
                  </div>

                  <Link
                    className="secondary"
                    href={`/parent/purchase-history?studentId=${student.id}`}
                    style={{
                      width: "auto",
                      flexShrink: 0,
                      whiteSpace:
                        "nowrap",
                      padding:
                        "6px 10px",
                      fontSize: 13,
                    }}
                  >
                    View Purchases
                  </Link>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="subtle">
            Approved children will appear here
            with their school, class, student
            code and purchase history.
          </p>
        )}
      </section>

      <div
        className="actions-row"
        style={{
          marginTop: 18,
        }}
      >
        <Link
          className="secondary"
          href="/parent/wallet"
        >
          Family Wallet
        </Link>

        <Link
          className="primary"
          href="/parent/preorders"
        >
          Pre-Orders
        </Link>

        <Link
          className="secondary"
          href="/parent/purchase-history"
        >
          Purchase History
        </Link>
      </div>

      <div
        className="actions-row"
        style={{
          marginTop: 18,
        }}
      >
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
    </main>
  );
}
