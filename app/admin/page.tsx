import Link from "next/link";
import { prisma } from "@/lib/prisma";

const links = [
  ["Dashboard", "/admin"],
  ["Registration Requests", "/admin/registrations"],
  ["Schools", "#"],
  ["Parents", "#"],
  ["Students", "#"],
  ["Cashiers", "#"],
  ["Products", "#"],
  ["Wallets", "#"],
  ["Top-up Requests", "/admin/topups"],
  ["Pre-Orders", "#"],
  ["Sales", "#"],
  ["Reports", "#"],
  ["Notifications", "#"],
  ["Settings", "#"],
] as const;

export default async function AdminDashboardPage() {
  const [pendingRegistrations, pendingTopUps, activeSchools, negativeWallets, preOrdersToday] = await Promise.all([
    prisma.parentRegistrationRequest.count({ where: { status: "PENDING" } }),
    prisma.topUpRequest.count({ where: { status: "PENDING" } }),
    prisma.school.count({ where: { isActive: true, deletedAt: null } }),
    prisma.wallet.count({ where: { balance: { lt: 0 } } }),
    prisma.preOrder.count({
      where: {
        pickupDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(24, 0, 0, 0)),
        },
        status: { in: ["CONFIRMED", "PREPARING", "READY"] },
      },
    }),
  ]);

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <h1>CanteenCo</h1>
        <nav className="nav">{links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav>
      </aside>
      <section className="content">
        <h2>Super Admin Dashboard</h2>
        <p className="subtle">Live foundation data from the CanteenCo database.</p>
        <div className="grid">
          <div className="stat">Today&apos;s sales<strong>$0.00</strong></div>
          <Link className="stat" href="/admin/registrations">Pending registrations<strong>{pendingRegistrations}</strong></Link>
          <Link className="stat" href="/admin/topups">Pending top-ups<strong>{pendingTopUps}</strong></Link>
          <div className="stat">Pre-orders today<strong>{preOrdersToday}</strong></div>
          <div className="stat">Negative wallets<strong>{negativeWallets}</strong></div>
          <div className="stat">Schools<strong>{activeSchools}</strong></div>
        </div>
      </section>
    </main>
  );
}
