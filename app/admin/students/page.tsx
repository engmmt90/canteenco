import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminSchoolScope } from "@/lib/admin-scope";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
}) {
  const { schoolId } =
    await adminSchoolScope();

  const params =
    await searchParams;

  const q =
    (params.q ?? "").trim();

  const status =
    (params.status ?? "").trim();

  const where: any = {
    deletedAt: null,

    ...(schoolId
      ? {
          schoolId,
        }
      : {}),

    ...(status
      ? {
          status,
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              displayCode: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              firstName: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              officialSchoolId: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              nfcCardNumber: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const students =
    await prisma.student.findMany({
      where,

      include: {
        school: true,

        parent: {
          include: {
            user: true,
            wallet: true,
          },
        },
      },

      orderBy: [
        {
          school: {
            name: "asc",
          },
        },
        {
          classCode: "asc",
        },
        {
          displayCode: "asc",
        },
      ],

      take: 200,
    });

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Students
          </h1>

          {status ===
            "PENDING_APPROVAL" && (
            <p className="subtle">
              Showing students waiting
              for approval.
            </p>
          )}
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      <form
        className="panel actions-row"
        method="get"
      >
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Name, 3C-001, school ID or NFC card number"
        />

        <select
          className="input"
          name="status"
          defaultValue={status}
        >
          <option value="">
            All statuses
          </option>

          <option value="PENDING_APPROVAL">
            PENDING APPROVAL
          </option>

          <option value="ACTIVE">
            ACTIVE
          </option>

          <option value="SUSPENDED">
            SUSPENDED
          </option>

          <option value="ARCHIVED">
            ARCHIVED
          </option>
        </select>

        <button
          className="primary"
          type="submit"
        >
          Search
        </button>

        {(q || status) && (
          <Link
            className="secondary"
            href="/admin/students"
          >
            Clear
          </Link>
        )}
      </form>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {students.map(
            (student) => {
              const pending =
                student.status ===
                "PENDING_APPROVAL";

              return (
                <Link
                  className="list-row"
                  href={`/admin/students/${student.id}`}
                  key={student.id}
                  style={
                    pending
                      ? {
                          border:
                            "2px solid #f59e0b",
                          background:
                            "#fffbeb",
                        }
                      : undefined
                  }
                >
                  <div>
                    <strong>
                      {student.firstName}{" "}
                      {student.lastName} ·{" "}
                      {student.displayCode}
                    </strong>

                    <div className="subtle compact">
                      {student.school.name}{" "}
                      · Class{" "}
                      {student.classCode}{" "}
                      · Parent:{" "}
                      {
                        student.parent
                          .user.fullName
                      }
                    </div>

                    <div className="subtle compact">
                      NFC:{" "}
                      {student.nfcCardNumber ??
                        "Not assigned"}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                    }}
                  >
                    <strong>
                      $
                      {Number(
                        student.parent
                          .wallet
                          ?.balance ??
                          0,
                      ).toFixed(2)}
                    </strong>

                    <div
                      className="subtle compact"
                      style={{
                        color: pending
                          ? "#b45309"
                          : undefined,
                        fontWeight: pending
                          ? 700
                          : undefined,
                      }}
                    >
                      {student.status}
                    </div>

                    {pending && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            "#b45309",
                        }}
                      >
                        Approval required
                      </div>
                    )}
                  </div>
                </Link>
              );
            },
          )}

          {!students.length && (
            <p className="subtle">
              No students found.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}