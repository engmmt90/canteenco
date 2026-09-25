import Link from "next/link";

import {
  staffLogin,
} from "@/app/actions/auth";

import PasswordField from "./password-field";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    remaining?: string;
    minutes?: string;
  }>;
};

export default async function StaffLoginPage({
  searchParams,
}: PageProps) {
  const {
    error,
    remaining,
    minutes,
  } = await searchParams;

  const parsedRemaining =
    Number.parseInt(
      remaining ?? "",
      10,
    );

  const remainingAttempts =
    Number.isFinite(
      parsedRemaining,
    ) &&
    parsedRemaining >= 1 &&
    parsedRemaining <= 4
      ? parsedRemaining
      : null;

  const parsedMinutes =
    Number.parseInt(
      minutes ?? "",
      10,
    );

  const minutesRemaining =
    Number.isFinite(
      parsedMinutes,
    ) &&
    parsedMinutes >= 1
      ? Math.min(
          parsedMinutes,
          30,
        )
      : 30;

  let errorMessage:
    | string
    | null = null;

  if (
    error === "blocked"
  ) {
    errorMessage =
      `Too many failed login attempts. Please try again in ${minutesRemaining} minute${
        minutesRemaining === 1
          ? ""
          : "s"
      }.`;
  } else if (
    error ===
    "invalid_credentials"
  ) {
    if (
      remainingAttempts !==
      null
    ) {
      const failedAttempt =
        5 -
        remainingAttempts;

      errorMessage =
        `Invalid email or password. Failed attempt ${failedAttempt} of 5 — ${remainingAttempts} attempt${
          remainingAttempts === 1
            ? ""
            : "s"
        } remaining.`;
    } else {
      errorMessage =
        "Invalid email or password, or your account is not allowed to sign in.";
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">
          CanteenGo Staff
        </h1>

        <p className="subtle">
          Admin and cashier access only.
        </p>

        {errorMessage ? (
          <p
            className="alert"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <form
          className="form"
          action={
            staffLogin
          }
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

          <PasswordField />

          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: 12,
              marginTop: -4,
            }}
          >
            <label
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 8,
                cursor:
                  "pointer",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                name="rememberMe"
                value="1"
              />

              Keep me logged in
            </label>

            <Link
              href="/staff/forgot-password"
              style={{
                fontSize: 14,
                textDecoration:
                  "none",
              }}
            >
              Forgot password?
            </Link>
          </div>

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
        >
          Staff Attendance
        </Link>

        <p
          className="subtle"
          style={{
            marginTop: 10,
          }}
        >
          No login required. Scan your
          staff NFC card to clock in or
          out.
        </p>

        <div
          style={{
            marginTop: 12,
          }}
        >
          <Link
            className="secondary"
            href="/"
          >
            Parent Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}