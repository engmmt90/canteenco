import { logout } from "@/app/actions/auth";
import { requireParent } from "@/lib/authz";

export default async function ParentDashboardPage() {
  const session = await requireParent();

  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">CanteenCo</h1>
        <h2>Family Wallet</h2>
        <p className="subtle">Signed in as {session.user.name ?? session.user.email}.</p>
        <div className="stat">Current balance<strong>$0.00</strong></div>
        <p className="subtle">Children, top-up requests, pre-orders and transaction history will connect here next.</p>
        <form action={logout}><button className="secondary" type="submit">Sign out</button></form>
      </section>
    </main>
  );
}
