import Link from "next/link";

import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage({
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
        <h1 className="brand">
          Reset Password
        </h1>

        {!token ? (
          <>
            <p className="alert">
              This password reset link is invalid.
              Please request a new link.
            </p>

            <Link
              className="primary"
              href="/parent/forgot-password"
            >
              Request New Link
            </Link>
          </>
        ) : (
          <>
            <p className="subtle">
              Choose a new password for your
              CanteenCo parent account.
            </p>

            <ResetPasswordForm token={token} />
          </>
        )}
      </section>
    </main>
  );
}
