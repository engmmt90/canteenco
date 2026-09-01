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

        {error === "invalid_credentials" ? (
          <p className="alert" role="alert">
            Invalid email or password, or your account is not allowed to sign in.
          </p>
        ) : null}

        <form className="form" action={staffLogin}>
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

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: -4,
            }}
          >
            <Link
              href="/staff/forgot-password"
              style={{
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>

          <button className="primary" type="submit">
            Staff Login
          </button>
        </form>

        <div className="divider" />

        <Link
          className="secondary"
          href="/staff/attendance"
        >
          Staff Attendance
        </Link>

        <p className="subtle" style={{ marginTop: 10 }}>
          No login required. Scan your staff NFC card to clock in or out.
        </p>

        <div style={{ marginTop: 12 }}>
          <Link className="secondary" href="/">
            Parent Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}