"use client";

import { useActionState, useState } from "react";
import {
  submitParentRegistration,
  type RegistrationFormState,
} from "@/app/actions/registration";

type SchoolOption = {
  id: string;
  name: string;
};

const initialState: RegistrationFormState = {};

export function ParentRegistrationForm({ schools }: { schools: SchoolOption[] }) {
  const [students, setStudents] = useState([0]);
  const [state, formAction, pending] = useActionState(submitParentRegistration, initialState);

  return (
    <form className="form" action={formAction}>
      {state.error ? <p className="alert" role="alert">{state.error}</p> : null}

      <h2 className="section-title">Parent details</h2>
      <label className="label">Full name<input className="input" name="fullName" required /></label>
      <label className="label">Email<input className="input" type="email" name="email" autoComplete="email" required /></label>
      <label className="label">Mobile<input className="input" type="tel" name="phone" autoComplete="tel" /></label>
      <label className="label">Password<input className="input" type="password" name="password" minLength={8} autoComplete="new-password" required /></label>

      <div className="divider" />
      <h2 className="section-title">Children</h2>
      <p className="subtle compact">Student codes are created automatically after approval in Class-first format, for example 3C-001.</p>
      <input type="hidden" name="studentCount" value={students.length} />

      {students.map((_, index) => (
        <fieldset className="student-block" key={index}>
          <legend>Student {index + 1}</legend>
          <div className="two-col">
            <label className="label">First name<input className="input" name={`students.${index}.firstName`} required /></label>
            <label className="label">Last name<input className="input" name={`students.${index}.lastName`} required /></label>
          </div>
          <label className="label">School
            <select className="input" name={`students.${index}.schoolId`} required defaultValue="">
              <option value="" disabled>Select school</option>
              {schools.map((school) => <option value={school.id} key={school.id}>{school.name}</option>)}
            </select>
          </label>
          <div className="two-col">
            <label className="label">Grade<input className="input" name={`students.${index}.grade`} placeholder="e.g. 3" required /></label>
            <label className="label">Class / Section<input className="input" name={`students.${index}.classSection`} placeholder="e.g. C" required /></label>
          </div>
          <label className="label">School student number (optional)<input className="input" name={`students.${index}.officialSchoolId`} /></label>
          {students.length > 1 ? (
            <button className="text-button" type="button" onClick={() => setStudents((current) => current.filter((__, itemIndex) => itemIndex !== index))}>Remove student</button>
          ) : null}
        </fieldset>
      ))}

      {students.length < 8 ? (
        <button className="secondary" type="button" onClick={() => setStudents((current) => [...current, current.length])}>+ Add another student</button>
      ) : null}
      <button className="primary" type="submit" disabled={pending}>{pending ? "Submitting..." : "Submit for Approval"}</button>
    </form>
  );
}
