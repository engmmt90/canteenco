import Link from "next/link";
import { cancelOwnTopUpRequest } from "@/app/actions/topups";
import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopUpForm } from "./topup-form";

function money(value: unknown) {
  return `$${Number(value).toFixed(2)}`;
}

export default async function ParentWalletPage() {
  const session = await requireParent();
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      wallet: {
        include: {
          topUpRequests: { orderBy: { createdAt: "desc" }, take: 20 },
          transactions: { orderBy: { createdAt: "desc" }, take: 20, include: { student: { select: { firstName: true, lastName: true, displayCode: true } } } },
        },
      },
    },
  });

  if (!parent?.wallet) {
    return <main className="content"><section className="panel"><h1>Family Wallet</h1><p>Your wallet is not available yet.</p></section></main>;
  }

  return (
    <main className="content wallet-page">
      <div className="page-heading">
        <div><h1 className="brand">Family Wallet</h1><p className="subtle">One balance shared by all approved children on your account.</p></div>
        <Link className="secondary" href="/parent/dashboard">Dashboard</Link>
      </div>

      <div className="grid">
        <div className="stat">Available balance<strong>{money(parent.wallet.balance)}</strong></div>
        <div className="stat">Wallet status<strong className="status-text">{parent.wallet.status}</strong></div>
      </div>

      <div className="wallet-layout">
        <section className="panel">
          <h2>Request a cash top-up</h2>
          <p className="subtle">Choose an amount now. Pay the cash to CanteenCo, then the administrator confirms it and your balance updates.</p>
          <TopUpForm />
        </section>

        <section className="panel">
          <h2>Top-up requests</h2>
          <div className="request-list">
            {parent.wallet.topUpRequests.length === 0 ? <p className="subtle compact">No top-up requests yet.</p> : null}
            {parent.wallet.topUpRequests.map((request) => (
              <div className="list-row" key={request.id}>
                <div><strong>{money(request.amount)}</strong><div className="subtle compact">{request.createdAt.toLocaleString("en-AU")} · {request.status}</div></div>
                {request.status === "PENDING" ? (
                  <form action={cancelOwnTopUpRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="danger small-button" type="submit">Cancel</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Recent wallet activity</h2>
        <div className="request-list">
          {parent.wallet.transactions.length === 0 ? <p className="subtle compact">No wallet transactions yet.</p> : null}
          {parent.wallet.transactions.map((transaction) => (
            <div className="list-row" key={transaction.id}>
              <div>
                <strong>{transaction.type}</strong>
                <div className="subtle compact">{transaction.student ? `${transaction.student.firstName} ${transaction.student.lastName} · ${transaction.student.displayCode} · ` : ""}{transaction.createdAt.toLocaleString("en-AU")}</div>
              </div>
              <div className="money-block"><strong>{Number(transaction.amount) >= 0 ? "+" : ""}{money(transaction.amount)}</strong><span>Balance {money(transaction.balanceAfter)}</span></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
