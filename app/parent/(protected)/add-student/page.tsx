import Link from "next/link";

import { addStudentForParent } from "@/app/actions/parent-add-student";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";

import ClassSelector from "./class-selector";

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

  const classes = await prisma.schoolClass.findMany({
    where: {
      isActive: true,

      school: {
        isActive: true,
        deletedAt: null,
      },
    },

    select: {
      id: true,
      schoolId: true,
      name: true,
      grade: true,
      section: true,
      classCode: true,
    },

    orderBy: [
      {
        grade: "asc",
      },
      {
        classCode: "asc",
      },
    ],
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
            Enter the student details and select
            the school and class from the available
            school classes.
          </p>

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

          <ClassSelector
            schools={schools}
            classes={classes}
          />

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
              The student will be added to your
              family account and submitted for
              school approval. The student will
              not be able to make purchases until
              approved.
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