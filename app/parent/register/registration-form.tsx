"use client";

import { useActionState, useMemo, useState } from "react";
import {
  submitParentRegistration,
  type RegistrationFormState,
} from "@/app/actions/registration";

type SchoolOption = {
  id: string;
  name: string;
};

type ClassOption = {
  id: string;
  schoolId: string;
  name: string;
  grade: string;
  section: string | null;
  classCode: string;
};

type StudentDraft = {
  key: number;
  schoolId: string;
};

const initialState: RegistrationFormState = {};

export function ParentRegistrationForm({
  schools,
  classes,
}: {
  schools: SchoolOption[];
  classes: ClassOption[];
}) {
  const [students, setStudents] = useState<StudentDraft[]>([
    { key: 0, schoolId: "" },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [state, formAction, pending] = useActionState(
    submitParentRegistration,
    initialState,
  );

  const classesBySchool = useMemo(() => {
    const map = new Map<string, ClassOption[]>();

    for (const schoolClass of classes) {
      const current = map.get(schoolClass.schoolId) ?? [];
      current.push(schoolClass);
      map.set(schoolClass.schoolId, current);
    }

    return map;
  }, [classes]);

  return (
    <form className="form" action={formAction}>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}

      <h2 className="section-title">Parent details</h2>

      <label className="label">
        Full name
        <input className="input" name="fullName" required />
      </label>

      <label className="label">
        Email
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>

      <label className="label">
        Mobile
        <input
          className="input"
          type="tel"
          name="phone"
          autoComplete="tel"
        />
      </label>

      <label className="label">
        Password
        <input
          className="input"
          type="password"
          name="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>

      <div className="divider" />

      <h2 className="section-title">Children</h2>

      <p className="subtle compact">
        Select the school first, then choose the student&apos;s class from the available class list.
      </p>

      <input
        type="hidden"
        name="studentCount"
        value={students.length}
      />

      {students.map((student, index) => {
        const availableClasses =
          classesBySchool.get(student.schoolId) ?? [];

        return (
          <fieldset className="student-block" key={student.key}>
            <legend>Student {index + 1}</legend>

            <div className="two-col">
              <label className="label">
                First name
                <input
                  className="input"
                  name={`students.${index}.firstName`}
                  required
                />
              </label>

              <label className="label">
                Last name
                <input
                  className="input"
                  name={`students.${index}.lastName`}
                  required
                />
              </label>
            </div>

            <label className="label">
              School

              <select
                className="input"
                name={`students.${index}.schoolId`}
                required
                value={student.schoolId}
                onChange={(event) => {
                  const schoolId = event.target.value;

                  setStudents((current) =>
                    current.map((item) =>
                      item.key === student.key
                        ? { ...item, schoolId }
                        : item,
                    ),
                  );
                }}
              >
                <option value="" disabled>
                  Select school
                </option>

                {schools.map((school) => (
                  <option value={school.id} key={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="label">
              Class

              <select
                className="input"
                name={`students.${index}.classId`}
                required
                disabled={
                  !student.schoolId ||
                  availableClasses.length === 0
                }
                defaultValue=""
                key={student.schoolId || "no-school"}
              >
                <option value="" disabled>
                  {!student.schoolId
                    ? "Select school first"
                    : availableClasses.length === 0
                      ? "No classes available"
                      : "Select class"}
                </option>

                {availableClasses.map((schoolClass) => (
                  <option
                    value={schoolClass.id}
                    key={schoolClass.id}
                  >
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </label>

            {student.schoolId &&
            availableClasses.length === 0 ? (
              <span className="subtle compact">
                No active classes are available for this school yet.
              </span>
            ) : null}

            <label className="label">
              School student number (optional)
              <input
                className="input"
                name={`students.${index}.officialSchoolId`}
              />
            </label>

            {students.length > 1 ? (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setStudents((current) =>
                    current.filter(
                      (item) => item.key !== student.key,
                    ),
                  )
                }
              >
                Remove student
              </button>
            ) : null}
          </fieldset>
        );
      })}

      {students.length < 8 ? (
        <button
          className="secondary"
          type="button"
          onClick={() => {
            const key = nextKey;
            setNextKey((current) => current + 1);
            setStudents((current) => [
              ...current,
              { key, schoolId: "" },
            ]);
          }}
        >
          + Add another student
        </button>
      ) : null}

      <button
        className="primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Submitting..." : "Submit for Approval"}
      </button>
    </form>
  );
}
