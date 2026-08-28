import Link from "next/link";

import ForgotPasswordForm from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">
          Forgot Password
        </h1>

        <p className="subtle">
          Enter the email address used
          for your CanteenCo parent
          account. We will send you a
          secure password reset link.
        </p>

        <ForgotPasswordForm />

        <div
          style={{
            marginTop: 16,
          }}
        >
          <Link
            className="secondary"
            href="/"
          >
            Back to Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
