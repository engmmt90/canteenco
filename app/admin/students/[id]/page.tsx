import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import {
  setStudentStatus,
  updateStudent,
} from "@/app/actions/admin-parents-students";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: {
      id,
    },
    include: {
      school: true,
      parent: {
        include: {
          user: true,
          wallet: {
            include: {
              transactions: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 20,
              },
            },
          },
        },
      },
      sales: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
      preOrders: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
    },
  });

  if (!student) {
    notFound();
  }

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== student.schoolId
  ) {
    notFound();
  }

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            {student.firstName} {student.lastName}
          </h1>

          <p className="subtle">
            {student.displayCode} · {student.school.name} · QR token retained
            internally
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin/students"
        >
          Students
        </Link>
      </div>

      <div className="grid">
        <div className="stat">
          Family Wallet
          <strong>
            $
            {Number(
              student.parent.wallet?.balance ?? 0,
            ).toFixed(2)}
          </strong>
        </div>

        <div className="stat">
          Status
          <strong>{student.status}</strong>
        </div>

        <div className="stat">
          Class
          <strong>{student.classCode}</strong>
        </div>

        <div className="stat">
          Sales
          <strong>{student.sales.length}</strong>
        </div>
      </div>

      <div className="wallet-layout">
        <form
          action={updateStudent}
          className="panel form"
        >
          <h2>Edit Student</h2>

          <input
            type="hidden"
            name="id"
            value={student.id}
          />

          <label className="label">
            First Name

            <input
              className="input"
              name="firstName"
              defaultValue={student.firstName}
              required
            />
          </label>

          <label className="label">
            Last Name

            <input
              className="input"
              name="lastName"
              defaultValue={student.lastName}
              required
            />
          </label>

          <label className="label">
            Grade

            <input
              className="input"
              name="grade"
              defaultValue={student.grade}
              required
            />
          </label>

          <label className="label">
            Class Section

            <input
              className="input"
              name="classSection"
              defaultValue={
                student.classSection ?? ""
              }
              required
            />
          </label>

          <label className="label">
            Official School ID

            <input
              className="input"
              name="officialSchoolId"
              defaultValue={
                student.officialSchoolId ?? ""
              }
              placeholder="Official school ID"
            />
          </label>

          <div className="divider" />

          <label className="label">
            NFC Card Number

            <input
              className="input"
              name="nfcCardNumber"
              defaultValue={
                student.nfcCardNumber ?? ""
              }
              placeholder="Tap NFC card on reader"
              autoComplete="off"
              inputMode="text"
            />
          </label>

          <p className="subtle compact">
            Place the NFC card on the reader while
            this field is selected. The reader will
            type the card number automatically.
          </p>

          <button
            className="primary"
            type="submit"
          >
            Save Changes
          </button>
        </form>

        <section className="panel">
          <h2>Account Controls</h2>

          <p>
            Parent:{" "}
            <Link
              href={`/admin/parents/${student.parent.id}`}
            >
              <strong>
                {student.parent.user.fullName}
              </strong>
            </Link>
          </p>

          <div className="actions-row">
            {student.status !== "ACTIVE" && (
              <form action={setStudentStatus}>
                <input
                  type="hidden"
                  name="id"
                  value={student.id}
                />

                <input
                  type="hidden"
                  name="status"
                  value="ACTIVE"
                />

                <button
                  className="primary"
                  type="submit"
                >
                  Activate
                </button>
              </form>
            )}

            {student.status !== "SUSPENDED" && (
              <form action={setStudentStatus}>
                <input
                  type="hidden"
                  name="id"
                  value={student.id}
                />

                <input
                  type="hidden"
                  name="status"
                  value="SUSPENDED"
                />

                <button
                  className="danger"
                  type="submit"
                >
                  Suspend
                </button>
              </form>
            )}

            <form action={setStudentStatus}>
              <input
                type="hidden"
                name="id"
                value={student.id}
              />

              <input
                type="hidden"
                name="status"
                value="ARCHIVED"
              />

              <button
                className="danger"
                type="submit"
              >
                Archive
              </button>
            </form>
          </div>
        </section>
      </div>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <h2>Recent Wallet Activity</h2>

        <div className="request-list">
          {(
            student.parent.wallet?.transactions ?? []
          )
            .filter(
              (transaction) =>
                !transaction.studentId ||
                transaction.studentId === student.id,
            )
            .map((transaction) => (
              <div
                className="list-row"
                key={transaction.id}
              >
                <div>
                  <strong>
                    {transaction.type}
                  </strong>

                  <div className="subtle compact">
                    {transaction.createdAt.toLocaleString(
                      "en-AU",
                    )}
                  </div>
                </div>

                <div>
                  <strong>
                    {Number(transaction.amount) >=
                    0
                      ? "+"
                      : ""}
                    $
                    {Number(
                      transaction.amount,
                    ).toFixed(2)}
                  </strong>

                  <div className="subtle compact">
                    Balance $
                    {Number(
                      transaction.balanceAfter,
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}