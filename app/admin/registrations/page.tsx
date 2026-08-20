import Link from "next/link";
import { approveParentRegistration, rejectParentRegistration } from "@/app/actions/registration";
import { prisma } from "@/lib/prisma";

export default async function RegistrationRequestsPage() {
  const requests = await prisma.parentRegistrationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      students: {
        include: { school: { select: { name: true } } },
      },
    },
  });

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">Parent Registration Requests</h1>
          <p className="subtle">Approve a request to create the parent account, family wallet and approved student records.</p>
        </div>
        <Link className="secondary" href="/admin">Back to Dashboard</Link>
      </div>

      <div className="request-list">
        {requests.length === 0 ? <section className="panel"><p>No pending registration requests.</p></section> : null}
        {requests.map((request) => (
          <section className="panel request-card" key={request.id}>
            <div className="request-head">
              <div><strong>{request.fullName}</strong><div className="subtle compact">{request.email}{request.phone ? ` · ${request.phone}` : ""}</div></div>
              <span className="badge">Pending</span>
            </div>
            <div className="student-summary">
              {request.students.map((student) => (
                <div className="student-row" key={student.id}>
                  <strong>{student.firstName} {student.lastName}</strong>
                  <span>{student.school.name} · Grade {student.grade}{student.classSection ? student.classSection : ""}</span>
                </div>
              ))}
            </div>
            <div className="actions-row">
              <form action={approveParentRegistration}>
                <input type="hidden" name="requestId" value={request.id} />
                <button className="primary" type="submit">Approve & Create Account</button>
              </form>
              <form action={rejectParentRegistration}>
                <input type="hidden" name="requestId" value={request.id} />
                <button className="danger" type="submit">Reject</button>
              </form>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
