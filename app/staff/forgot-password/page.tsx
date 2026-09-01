import Link from "next/link";
import StaffForgotPasswordForm from "./forgot-password-form";

export default function StaffForgotPasswordPage() {
  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">Forgot Password</h1>

        <p className="subtle">
          Enter the email address used for your CanteenCo admin,
          school admin, or cashier account. We will send you a secure
          password reset link.
        </p>

        <StaffForgotPasswordForm />

        <div style={{ marginTop: 16 }}>
          <Link className="secondary" href="/staff/login">
            Back to Staff Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
