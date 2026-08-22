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
  const { schoolId } = await adminSchoolScope();

  const params = await searchParams;

  const q = (params.q ?? "").trim();
  const status = params.status ?? "";

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
        <h1 className="brand">
          Students
        </h1>

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
      </form>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {students.map((student) => (
            <Link
              className="list-row"
              href={`/admin/students/${student.id}`}
              key={student.id}
            >
              <div>
                <strong>
                  {student.firstName}{" "}
                  {student.lastName} ·{" "}
                  {student.displayCode}
                </strong>

                <div className="subtle compact">
                  {student.school.name} · Class{" "}
                  {student.classCode} · Parent:{" "}
                  {student.parent.user.fullName}
                </div>

                <div className="subtle compact">
                  NFC:{" "}
                  {student.nfcCardNumber ??
                    "Not assigned"}
                </div>
              </div>

              <div>
                <strong>
                  $
                  {Number(
                    student.parent.wallet
                      ?.balance ?? 0,
                  ).toFixed(2)}
                </strong>

                <div className="subtle compact">
                  {student.status}
                </div>
              </div>
            </Link>
          ))}

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