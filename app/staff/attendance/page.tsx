import Link from "next/link";

import StaffAttendanceClient from "./staff-attendance-client";

export default function StaffAttendancePage() {
  return (
    <main className="shell">
      <section className="card">
        <div
          className="page-heading"
          style={{
            alignItems: "center",
          }}
        >
          <div>
            <h1 className="brand">
              Staff Attendance
            </h1>

            <p className="subtle">
              Scan your staff NFC card to
              clock in or clock out.
            </p>
          </div>

          <Link
            className="secondary"
            href="/staff/login"
          >
            Staff Login
          </Link>
        </div>

        <StaffAttendanceClient />
      </section>
    </main>
  );
}
