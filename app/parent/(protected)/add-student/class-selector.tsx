"use client";

import { useMemo, useState } from "react";

type School = {
  id: string;
  name: string;
  code: string | null;
};

type SchoolClass = {
  id: string;
  schoolId: string;
  name: string;
  grade: string;
  section: string | null;
  classCode: string;
};

type Props = {
  schools: School[];
  classes: SchoolClass[];
};

export default function ClassSelector({
  schools,
  classes,
}: Props) {
  const [schoolId, setSchoolId] = useState("");

  const availableClasses = useMemo(() => {
    if (!schoolId) {
      return [];
    }

    return classes.filter(
      (schoolClass) =>
        schoolClass.schoolId === schoolId,
    );
  }, [classes, schoolId]);

  return (
    <>
      <label className="label">
        School

        <select
          className="input"
          name="schoolId"
          required
          value={schoolId}
          onChange={(event) => {
            setSchoolId(event.target.value);
          }}
        >
          <option value="" disabled>
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
        Class

        <select
          className="input"
          name="classId"
          required
          disabled={
            !schoolId ||
            availableClasses.length === 0
          }
          defaultValue=""
        >
          <option value="" disabled>
            {!schoolId
              ? "Select school first"
              : availableClasses.length === 0
                ? "No classes available"
                : "Select class"}
          </option>

          {availableClasses.map((schoolClass) => (
            <option
              key={schoolClass.id}
              value={schoolClass.id}
            >
              {schoolClass.name}
            </option>
          ))}
        </select>

        {schoolId &&
          availableClasses.length === 0 && (
            <span className="subtle compact">
              No active classes are available
              for this school yet.
            </span>
          )}
      </label>
    </>
  );
}