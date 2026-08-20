import Link from "next/link";
import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ParentNotificationsPage() {
  const session = await requireParent();
  const items = await prisma.notification.findMany({
    where: { userId: session.user.id, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <main className="content">
    <div className="page-heading">
      <div><h1 className="brand">Notifications</h1><p className="subtle">Your latest CanteenCo account activity.</p></div>
      <div className="actions-row">
        <Link className="secondary" href="/parent/settings/notifications">Preferences</Link>
        <Link className="secondary" href="/parent/dashboard">Dashboard</Link>
      </div>
    </div>
    <section className="panel"><div className="request-list">
      {items.length===0?<p className="subtle compact">No notifications yet.</p>:items.map(n=>
        <article className="list-row" key={n.id}>
          <div><strong>{n.subject || n.event}</strong><div className="subtle compact">{n.message}</div></div>
          <span className="subtle compact">{n.createdAt.toLocaleString("en-AU")}</span>
        </article>
      )}
    </div></section>
  </main>;
}
