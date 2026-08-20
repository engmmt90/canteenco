import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";

export default async function ParentDashboardPage() {
  const session = await requireParent();
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      wallet: true,
      students: {
        where: { deletedAt: null },
        include: { school: { select: { name: true } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
    },
  });

  return (
    <main className="shell">
      <section className="card registration-card">
        <h1 className="brand">CanteenCo</h1>
        <h2>Family Wallet</h2>
        <p className="subtle">Signed in as {session.user.name ?? session.user.email}.</p>
        <div className="grid">
          <div className="stat">Current balance<strong>${Number(parent?.wallet?.balance ?? 0).toFixed(2)}</strong></div>
          <div className="stat">Children<strong>{parent?.students.length ?? 0}</strong></div>
        </div>
        <div className="divider" />
        <h2 className="section-title">Children</h2>
        <div className="request-list">
          {parent?.students.map((student) => (
            <div className="student-row" key={student.id}>
              <strong>{student.firstName} {student.lastName}</strong>
              <span>{student.school.name} · {student.displayCode} · Grade {student.grade}{student.classSection ?? ""}</span>
            </div>
          ))}
          {!parent?.students.length ? <p className="subtle">No approved students are linked to this account yet.</p> : null}
        </div>
        <div className="divider" />
        <form action={logout}><button className="secondary" type="submit">Sign out</button></form>
      </section>
    </main>
  );
}
