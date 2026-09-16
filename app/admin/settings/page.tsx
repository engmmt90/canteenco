import Link from "next/link";

import {
  changeAdminPassword,
} from "@/app/actions/admin-security";

import PasswordFields from "./password-fields";

import {
  requireAdmin,
} from "@/lib/authz";

function yes(
  value?: string,
) {
  return Boolean(
    value &&
      value.trim(),
  );
}

function getPasswordError(
  code?: string,
) {
  switch (code) {
    case "required":
      return "Please complete all password fields.";

    case "length":
      return "New password must be at least 8 characters.";

    case "mismatch":
      return "New password and confirmation do not match.";

    case "current":
      return "Current password is incorrect.";

    case "same":
      return "New password must be different from your current password.";

    case "account":
      return "Unable to change the password for this account.";

    default:
      return null;
  }
}

type PageProps = {
  searchParams: Promise<{
    changePassword?: string;
    passwordError?: string;
  }>;
};

export default async function SystemSettingsPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const params =
    await searchParams;

  const errorMessage =
    getPasswordError(
      params.passwordError,
    );

  const showPasswordForm =
    params.changePassword === "1" ||
    Boolean(errorMessage);

  const emailReady =
    yes(
      process.env
        .RESEND_API_KEY,
    ) &&
    yes(
      process.env
        .NOTIFICATION_EMAIL_FROM,
    );

  const smsReady =
    yes(
      process.env
        .TWILIO_ACCOUNT_SID,
    ) &&
    yes(
      process.env
        .TWILIO_AUTH_TOKEN,
    ) &&
    yes(
      process.env
        .TWILIO_FROM_NUMBER,
    );

  const workerReady =
    yes(
      process.env
        .NOTIFICATION_WORKER_SECRET,
    );

  const dbReady =
    yes(
      process.env
        .DATABASE_URL,
    );

  const authReady =
    yes(
      process.env
        .AUTH_SECRET,
    );

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            System Settings
          </h1>

          <p className="subtle">
            Environment readiness and
            platform-level configuration
            status.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      <div className="grid">
        <div className="stat">
          Database
          <strong>
            {dbReady
              ? "READY"
              : "MISSING"}
          </strong>
        </div>

        <div className="stat">
          Authentication
          <strong>
            {authReady
              ? "READY"
              : "MISSING"}
          </strong>
        </div>

        <div className="stat">
          Email provider
          <strong>
            {emailReady
              ? "READY"
              : "NOT CONFIGURED"}
          </strong>
        </div>

        <div className="stat">
          SMS provider
          <strong>
            {smsReady
              ? "READY"
              : "NOT CONFIGURED"}
          </strong>
        </div>

        <div className="stat">
          Notification worker
          <strong>
            {workerReady
              ? "READY"
              : "MISSING"}
          </strong>
        </div>
      </div>

      {!showPasswordForm ? (
        <section
          className="panel"
          style={{
            marginTop: 18,
          }}
        >
          <h2>
            Account Security
          </h2>

          <p className="subtle">
            Update your admin account
            password and invalidate old
            login sessions.
          </p>

          <Link
            className="primary"
            href="/admin/settings?changePassword=1"
          >
            Change Password
          </Link>
        </section>
      ) : (
        <form
          action={
            changeAdminPassword
          }
          className="panel form"
          style={{
            marginTop: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              Change Password
            </h2>

            <Link
              className="secondary"
              href="/admin/settings"
            >
              Cancel
            </Link>
          </div>

          <p className="subtle">
            Changing your password will
            sign you out and invalidate
            your existing admin sessions
            on other devices.
          </p>

          {errorMessage ? (
            <p
              className="alert"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <PasswordFields />

          <button
            className="primary"
            type="submit"
          >
            Change Password
          </button>
        </form>
      )}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <h2>
          Security note
        </h2>

        <p className="subtle">
          This page shows configuration
          status only. API keys,
          passwords and secrets are
          never displayed in the admin
          interface.
        </p>
      </section>
    </main>
  );
}