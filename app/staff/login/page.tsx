import Link from "next/link";

import { staffLogin } from "@/app/actions/auth";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function StaffLoginPage({
  searchParams,
}: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">
          CanteenCo Staff
        </h1>

        <p className="subtle">
          Admin and cashier access only.
        </p>

        {error ===
        "invalid_credentials" ? (
          <p
            className="alert"
            role="alert"
          >
            Invalid staff credentials or
            inactive account.
          </p>
        ) : null}

        <form
          className="form"
          action={staffLogin}
        >
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
            Password

            <input
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          <button
            className="primary"
            type="submit"
          >
            Staff Login
          </button>
        </form>

        <div className="divider" />

        <Link
          className="secondary"
          href="/staff/attendance"
          style={{
            width: "100%",
            textAlign: "center",
          }}
        >
          Staff Attendance
        </Link>

        <p
          className="subtle compact"
          style={{
            marginTop: 10,
            textAlign: "center",
          }}
        >
          No login required. Scan your staff
          NFC card to clock in or out.
        </p>
      </section>
    </main>
  );
}