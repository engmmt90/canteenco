import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { saveSchool } from "@/app/actions/admin-management";

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

  const schools = await prisma.school.findMany({
    where: {
      deletedAt: null,
    },

    include: {
      settings: true,
      _count: {
        select: {
          students: true,
          users: true,
        },
      },
    },

    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="content">
      <div className="page-heading">
        <h1 className="brand">Schools</h1>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      {session.user.role === "SUPER_ADMIN" &&
        !showAddForm && (
          <div style={{ marginBottom: 18 }}>
            <Link
              className="primary"
              href="/admin/schools?add=1"
            >
              + Create School
            </Link>
          </div>
        )}

      {session.user.role === "SUPER_ADMIN" &&
        showAddForm && (
          <form
            action={saveSchool}
            className="panel form"
          >
            <h2>Add School</h2>

            <input
              className="input"
              name="name"
              placeholder="School name"
              required
            />

            <input
              className="input"
              name="code"
              placeholder="Code"
              required
            />

            <input
              className="input"
              name="address"
              placeholder="Address"
            />

            <input
              className="input"
              name="email"
              type="email"
              placeholder="Email"
            />

            <input
              className="input"
              name="phone"
              placeholder="Phone"
            />

            <input
              className="input"
              name="timezone"
              defaultValue="Australia/Brisbane"
            />

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
              style={{ marginTop: 6 }}
            >
              <button
                className="primary"
                type="submit"
              >
                Create School
              </button>

              <Link
                className="secondary"
                href="/admin/schools"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}

      <section
        className="panel"
        style={{ marginTop: 18 }}
      >
        <div className="request-list">
          {schools.map((school) => (
            <div
              className="list-row"
              key={school.id}
            >
              <div>
                <strong>
                  {school.name} · {school.code}
                </strong>

                <div className="subtle compact">
                  {school._count.students} students ·{" "}
                  {school._count.users} staff ·{" "}
                  {school.settings?.timezone}
                </div>
              </div>

              <div className="actions-row">
                <span className="badge">
                  {school.isActive
                    ? "ACTIVE"
                    : "INACTIVE"}
                </span>

                <Link
                  className="secondary"
                  href={`/admin/schools/${school.id}/settings`}
                >
                  Settings
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
