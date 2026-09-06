import BackButton from "./back-button";
import StaffAttendanceClient from "./staff-attendance-client";

export default function StaffAttendancePage() {
  return (
    <main className="shell">
      <section className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <h1 className="brand">
              Staff Attendance
            </h1>

            <p className="subtle">
              Scan your staff NFC card to clock in or
              clock out.
            </p>
          </div>

          <BackButton />
        </div>

        <div className="divider" />

        <StaffAttendanceClient />
      </section>
    </main>
  );
}