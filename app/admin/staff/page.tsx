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
          staffSchoolAccess: {
            include: {
              school: true,
            },
          },
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

          <label className="label">
            NFC Card

            <input
              className="input"
              name="nfcCardNumber"
              placeholder="Tap or scan staff NFC card"
              autoComplete="off"
            />
          </label>

          <label className="label">
            Role

            <select
              className="input"
              name="role"
            >
              <option value="CASHIER">
                Cashier
              </option>

              <option value="STAFF">
                Staff
              </option>

              {session.user.role ===
                "SUPER_ADMIN" && (
                <option value="SCHOOL_ADMIN">
                  School Admin
                </option>
              )}
            </select>
          </label>

          <label className="label">
            Base School

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
          </label>

          {session.user.role ===
          "SUPER_ADMIN" ? (
            <section
              style={{
                padding: 14,
                border:
                  "1px solid #e5e7eb",
                borderRadius: 12,
              }}
            >
              <strong>
                Attendance School Access
              </strong>

              <p className="subtle compact">
                This controls where the staff
                member can clock in and out. It
                does not change cashier login
                permissions.
              </p>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <input
                  type="checkbox"
                  name="canWorkAllSchools"
                />{" "}
                Can work at all schools
              </label>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <span className="subtle">
                  Or choose specific schools:
                </span>

                {schools.map((school) => (
                  <label
                    key={school.id}
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      name="allowedSchoolIds"
                      value={school.id}
                    />{" "}
                    {school.name}
                  </label>
                ))}
              </div>
            </section>
          ) : (
            <p className="subtle">
              Attendance access: this school
              only.
            </p>
          )}

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

                <div
                  className="subtle compact"
                  style={{
                    marginTop: 4,
                  }}
                >
                  NFC:{" "}
                  {user.nfcCardNumber
                    ? "ASSIGNED"
                    : "NOT ASSIGNED"}
                  {" · "}
                  Attendance:{" "}
                  {user.canWorkAllSchools
                    ? "ALL SCHOOLS"
                    : user.staffSchoolAccess
                        .map(
                          (access) =>
                            access.school.name,
                        )
                        .join(", ") ||
                      "BASE SCHOOL"}
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