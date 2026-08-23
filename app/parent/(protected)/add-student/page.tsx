import Link from "next/link";

import { addStudentForParent } from "@/app/actions/parent-add-student";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";

export default async function AddStudentPage() {
  await requireParent();

  const schools = await prisma.school.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },

    select: {
      id: true,
      name: true,
      code: true,
    },

    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="shell">
      <section className="card registration-card">
        <div
          className="page-heading"
          style={{
            alignItems: "center",
          }}
        >
          <div>
            <h1 className="brand">
              Add Student
            </h1>

            <p className="subtle">
              Add another student to your family account.
            </p>
          </div>

          <Link
            className="secondary"
            href="/parent"
          >
            Back
          </Link>
        </div>

        <div className="divider" />

        <form
          action={addStudentForParent}
          className="form"
        >
          <h2>
            Student Information
          </h2>

          <p className="subtle">
            Enter the student details only.
            Your existing parent account will
            be used automatically.
          </p>

          <label className="label">
            School

            <select
              className="input"
              name="schoolId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Select school
              </option>

              {schools.map((school) => (
                <option
                  key={school.id}
                  value={school.id}
                >
                  {school.name}
                  {school.code
                    ? ` (${school.code})`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            First name

            <input
              className="input"
              name="firstName"
              required
              autoComplete="given-name"
              placeholder="Student first name"
            />
          </label>

          <label className="label">
            Last name

            <input
              className="input"
              name="lastName"
              required
              autoComplete="family-name"
              placeholder="Student last name"
            />
          </label>

          <label className="label">
            Grade

            <input
              className="input"
              name="grade"
              required
              placeholder="e.g. 3"
            />
          </label>

          <label className="label">
            Class / Section

            <input
              className="input"
              name="classSection"
              required
              placeholder="e.g. C"
            />
          </label>

          <label className="label">
            Official School ID

            <span className="subtle compact">
              Optional
            </span>

            <input
              className="input"
              name="officialSchoolId"
              placeholder="Optional school ID"
            />
          </label>

          <div className="panel">
            <strong>
              What happens next?
            </strong>

            <p className="subtle compact">
              The student will be added to
              your family account and submitted
              for school approval. The student
              will not be able to make purchases
              until approved.
            </p>
          </div>

          <div className="actions-row">
            <Link
              className="secondary"
              href="/parent"
            >
              Cancel
            </Link>

            <button
              className="primary"
              type="submit"
            >
              Add Student
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}