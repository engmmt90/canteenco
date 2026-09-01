import Link from "next/link";
import StaffResetPasswordForm from "./reset-password-form";

export default async function StaffResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
  }>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();

  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">Reset Password</h1>

        {!token ? (
          <>
            <p className="alert">
              This password reset link is invalid. Please request a new link.
            </p>

            <Link
              className="primary"
              href="/staff/forgot-password"
            >
              Request New Link
            </Link>
          </>
        ) : (
          <>
            <p className="subtle">
              Choose a new password for your CanteenCo staff account.
            </p>

            <StaffResetPasswordForm token={token} />
          </>
        )}
      </section>
    </main>
  );
}