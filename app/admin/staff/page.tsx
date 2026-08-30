import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { saveStaff } from "@/app/actions/admin-management";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string;
  }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const showAddForm = params.add === "1";

  const schoolWhere =
    session.user.role === "SCHOOL_ADMIN"
      ? {
          id:
            session.user.schoolId ??
            "__none__",
        }
      : {
          isActive: true,
          deletedAt: null,
        };

  const [schools, staff] =
    await Promise.all([
      prisma.school.findMany({
        where: schoolWhere,
        orderBy: {
          name: "asc",
        },
      }),

      prisma.user.findMany({
        where: {
          role: {
            in: [
              "CASHIER",
              "SCHOOL_ADMIN",
            ],
          },

          deletedAt: null,

          ...(session.user.role ===
          "SCHOOL_ADMIN"
            ? {
                schoolId:
                  session.user.schoolId,
              }
            : {}),
        },

        include: {
          school: true,
        },

        orderBy: {
          fullName: "asc",
        },
      }),
    ]);

  return (
    <main className="content">
      <div className="page-heading">
        <h1 className="brand">
          Staff
        </h1>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      {!showAddForm && (
        <div
          style={{
            marginBottom: 18,
          }}
        >
          <Link
            className="primary"
            href="/admin/staff?add=1"
          >
            + Create Staff
          </Link>
        </div>
      )}

      {showAddForm && (
        <form
          action={saveStaff}
          className="panel form"
        >
          <h2>Add Staff Member</h2>

          <input
            className="input"
            name="fullName"
            placeholder="Full name"
            required
          />

          <input
            className="input"
            name="email"
            type="email"
            placeholder="Email"
            required
          />

          <input
            className="input"
            name="phone"
            placeholder="Phone"
          />

          <input
            className="input"
            name="password"
            type="password"
            placeholder="Temporary password (8+ chars)"
            required
          />

          <select
            className="input"
            name="role"
          >
            <option value="CASHIER">
              Cashier
            </option>

            {session.user.role ===
              "SUPER_ADMIN" && (
              <option value="SCHOOL_ADMIN">
                School Admin
              </option>
            )}
          </select>

          <select
            className="input"
            name="schoolId"
            required
          >
            {schools.map((school) => (
              <option
                key={school.id}
                value={school.id}
              >
                {school.name}
              </option>
            ))}
          </select>

          <label>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
            />{" "}
            Active
          </label>

          <div
            className="actions-row"
            style={{
              marginTop: 6,
            }}
          >
            <button
              className="primary"
              type="submit"
            >
              Create Staff
            </button>

            <Link
              className="secondary"
              href="/admin/staff"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {staff.map((user) => (
            <div
              className="list-row"
              key={user.id}
            >
              <div>
                <strong>
                  {user.fullName}
                </strong>

                <div className="subtle compact">
                  {user.email} ·{" "}
                  {user.school?.name}
                </div>
              </div>

              <span className="badge">
                {user.role} ·{" "}
                {user.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
