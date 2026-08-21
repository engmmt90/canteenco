import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import AdminMobileNav from "./admin-mobile-nav";

const links = [
  ["Dashboard", "/admin"],
  ["Registration Requests", "/admin/registrations"],
  ["Schools", "/admin/schools"],
  ["Parents", "/admin/parents"],
  ["Students", "/admin/students"],
  ["Staff", "/admin/staff"],
  ["Products", "/admin/products"],
  ["Wallets", "/admin/wallets"],
  ["Top-up Requests", "/admin/topups"],
  ["Pre-Orders", "/admin/orders"],
  ["Sales", "/admin/sales"],
  ["Reports", "/admin/reports"],
  ["Notifications", "/admin/notifications"],
  ["Audit Log", "/admin/audit"],
  ["Settings", "/admin/settings"],
] as const;

export default async function AdminDashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const salesToday = await prisma.sale.aggregate({
    where: {
      status: "COMPLETED",
      createdAt: { gte: today },
    },
    _sum: { total: true },
  });

  const [
    pendingRegistrations,
    pendingTopUps,
    activeSchools,
    negativeWallets,
    preOrdersToday,
    failedNotifications,
  ] = await Promise.all([
    prisma.parentRegistrationRequest.count({
      where: { status: "PENDING" },
    }),

    prisma.topUpRequest.count({
      where: { status: "PENDING" },
    }),

    prisma.school.count({
      where: {
        isActive: true,
        deletedAt: null,
      },
    }),

    prisma.wallet.count({
      where: {
        balance: { lt: 0 },
      },
    }),

    prisma.preOrder.count({
      where: {
        pickupDate: {
          gte: new Date(
            new Date().setHours(0, 0, 0, 0),
          ),
          lt: new Date(
            new Date().setHours(24, 0, 0, 0),
          ),
        },
        status: {
          in: [
            "CONFIRMED",
            "PREPARING",
            "READY",
          ],
        },
      },
    }),

    prisma.notification.count({
      where: {
        failedAt: { not: null },
      },
    }),
  ]);

  return (
    <main className="dashboard">
      {/* Mobile navigation */}
      <AdminMobileNav />

      {/* Desktop navigation */}
      <aside className="sidebar">
        <h1>CanteenCo</h1>

        <nav className="nav">
          {links.map(([label, href]) => (
            <Link href={href} key={label}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="divider" />

        <form action={logout}>
          <button
            className="secondary"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </aside>

      {/* Dashboard content */}
      <section className="content">
        <h2>Super Admin Dashboard</h2>

        <p className="subtle">
          Live foundation data from the
          CanteenCo database.
        </p>

        <div className="grid">
          <Link
            className="stat"
            href="/admin/reports"
          >
            Today&apos;s sales

            <strong>
              $
              {Number(
                salesToday._sum.total ?? 0,
              ).toFixed(2)}
            </strong>
          </Link>

          <Link
            className="stat"
            href="/admin/registrations"
          >
            Pending registrations

            <strong>
              {pendingRegistrations}
            </strong>
          </Link>

          <Link
            className="stat"
            href="/admin/topups"
          >
            Pending top-ups

            <strong>
              {pendingTopUps}
            </strong>
          </Link>

          <div className="stat">
            Pre-orders today

            <strong>
              {preOrdersToday}
            </strong>
          </div>

          <Link
            className="stat"
            href="/admin/wallets?negative=1"
          >
            Negative wallets

            <strong>
              {negativeWallets}
            </strong>
          </Link>

          <div className="stat">
            Schools

            <strong>
              {activeSchools}
            </strong>
          </div>

          <Link
            className="stat"
            href="/admin/notifications?state=failed"
          >
            Failed notifications

            <strong>
              {failedNotifications}
            </strong>
          </Link>
        </div>
      </section>
    </main>
  );
}