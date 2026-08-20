import Link from "next/link";
import { cancelTopUpRequestAsAdmin, confirmTopUpRequest } from "@/app/actions/topups";
import { prisma } from "@/lib/prisma";

function money(value: unknown) {
  return `$${Number(value).toFixed(2)}`;
}

export default async function AdminTopUpsPage() {
  const requests = await prisma.topUpRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      requestedBy: { select: { fullName: true, email: true, phone: true } },
      wallet: {
        include: {
          parent: {
            include: {
              students: { where: { deletedAt: null }, select: { firstName: true, lastName: true, displayCode: true, school: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  return (
    <main className="content">
      <div className="page-heading">
        <div><h1 className="brand">Pending Top-Up Requests</h1><p className="subtle">Confirm only after you have physically received the cash payment.</p></div>
        <Link className="secondary" href="/admin">Back to Dashboard</Link>
      </div>

      <div className="request-list">
        {requests.length === 0 ? <section className="panel"><p>No pending top-up requests.</p></section> : null}
        {requests.map((request) => (
          <section className="panel request-card" key={request.id}>
            <div className="request-head">
              <div>
                <strong>{request.requestedBy.fullName}</strong>
                <div className="subtle compact">{request.requestedBy.email}{request.requestedBy.phone ? ` · ${request.requestedBy.phone}` : ""}</div>
              </div>
              <div className="topup-amount">{money(request.amount)}</div>
            </div>
            <div className="subtle compact">Current family wallet balance: <strong>{money(request.wallet.balance)}</strong> · Requested {request.createdAt.toLocaleString("en-AU")}</div>
            <div className="student-summary">
              {request.wallet.parent.students.map((student) => (
                <div className="student-row" key={student.displayCode}>
                  <strong>{student.firstName} {student.lastName}</strong>
                  <span>{student.displayCode} · {student.school.name}</span>
                </div>
              ))}
            </div>
            <div className="actions-row">
              <form action={confirmTopUpRequest}>
                <input type="hidden" name="requestId" value={request.id} />
                <button className="primary" type="submit">Cash Received — Confirm Top-Up</button>
              </form>
              <form action={cancelTopUpRequestAsAdmin}>
                <input type="hidden" name="requestId" value={request.id} />
                <button className="danger" type="submit">Cancel Request</button>
              </form>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
