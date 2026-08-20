import Link from "next/link";
import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ParentDashboardPage() {
  const session = await requireParent();
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: { wallet: true, students: { where: { deletedAt: null }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] } },
  });
  const balance = parent?.wallet ? Number(parent.wallet.balance).toFixed(2) : "0.00";

  return (
    <main className="content">
      <div className="page-heading"><div><h1 className="brand">Family Dashboard</h1><p className="subtle">Welcome back. Your family wallet is shared by all approved children.</p></div><Link className="primary" href="/parent/wallet">Top Up Wallet</Link></div>
      <div className="grid"><Link className="stat" href="/parent/wallet">Available balance<strong>${balance}</strong></Link><div className="stat">Children<strong>{parent?.students.length ?? 0}</strong></div><div className="stat">Pre-orders<strong>0</strong></div></div>
      <div style={{height:18}}/><section className="panel"><h2>Children</h2>{parent?.students.length ? <div className="student-summary">{parent.students.map((student) => <div className="student-row" key={student.id}><strong>{student.firstName} {student.lastName}</strong><span>{student.displayCode} · Grade {student.grade}{student.classSection ?? ""}</span></div>)}</div> : <p className="subtle">Approved children will appear here with their school, class, student code and purchase history.</p>}</section>
    <div className="actions-row" style={{marginTop:18}}><a className="secondary" href="/parent/wallet">Family Wallet</a><a className="primary" href="/parent/preorders">Pre-Orders</a></div><div className="actions-row" style={{marginTop:18}}><a className="secondary" href="/parent/notifications">Notifications</a><a className="secondary" href="/parent/settings/notifications">Notification Preferences</a></div></main>
  );
}
