import Link from "next/link";

import {
  changeAdminLoginEmail,
  changeAdminPassword,
} from "@/app/actions/admin-security";

import CurrentPasswordField from "./current-password-field";
import PasswordFields from "./password-fields";

import {
  requireAdmin,
} from "@/lib/authz";

import {
  prisma,
} from "@/lib/prisma";

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

function getEmailError(
  code?: string,
) {
  switch (code) {
    case "required":
      return "Please enter the new login email and your current password.";

    case "invalid":
      return "Please enter a valid email address.";

    case "password":
      return "Current password is incorrect.";

    case "same":
      return "The new login email is the same as your current email.";

    case "in_use":
      return "This email address is already used by another account.";

    case "account":
      return "Unable to update the login email for this account.";

    default:
      return null;
  }
}

type PageProps = {
  searchParams: Promise<{
    changePassword?: string;
    passwordError?: string;

    changeEmail?: string;
    emailError?: string;
  }>;
};

export default async function SystemSettingsPage({
  searchParams,
}: PageProps) {
  const session =
    await requireAdmin();

  const params =
    await searchParams;

  const passwordErrorMessage =
    getPasswordError(
      params.passwordError,
    );

  const emailErrorMessage =
    getEmailError(
      params.emailError,
    );

  const showPasswordForm =
    params.changePassword ===
      "1" ||
    Boolean(
      passwordErrorMessage,
    );

  const showEmailForm =
    !showPasswordForm &&
    (
      params.changeEmail ===
        "1" ||
      Boolean(
        emailErrorMessage,
      )
    );

  const account =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },

      select: {
        email: true,
      },
    });

  const currentEmail =
    account?.email ??
    "";

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

      {!showPasswordForm &&
      !showEmailForm ? (
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
            Manage your admin login
            details and security.
          </p>

          <div
            style={{
              marginTop: 14,
              marginBottom: 18,
            }}
          >
            <div
              className="subtle"
              style={{
                fontSize: 13,
              }}
            >
              Current login email
            </div>

            <strong>
              {currentEmail}
            </strong>
          </div>

          <div
            className="actions-row"
            style={{
              display: "flex",
              gap: 10,
              flexWrap:
                "wrap",
            }}
          >
            <Link
              className="primary"
              href="/admin/settings?changePassword=1"
            >
              Change Password
            </Link>

            <Link
              className="secondary"
              href="/admin/settings?changeEmail=1"
            >
              Change Login Email
            </Link>
          </div>
        </section>
      ) : null}

      {showPasswordForm ? (
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
            your existing admin
            sessions on other devices.
          </p>

          {passwordErrorMessage ? (
            <p
              className="alert"
              role="alert"
            >
              {
                passwordErrorMessage
              }
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
      ) : null}

      {showEmailForm ? (
        <form
          action={
            changeAdminLoginEmail
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
              Change Login Email
            </h2>

            <Link
              className="secondary"
              href="/admin/settings"
            >
              Cancel
            </Link>
          </div>

          <p className="subtle">
            After changing your login
            email, you will be signed
            out and all existing admin
            sessions will be
            invalidated.
          </p>

          <div>
            <div
              className="subtle"
              style={{
                fontSize: 13,
              }}
            >
              Current login email
            </div>

            <strong>
              {currentEmail}
            </strong>
          </div>

          {emailErrorMessage ? (
            <p
              className="alert"
              role="alert"
            >
              {
                emailErrorMessage
              }
            </p>
          ) : null}

          <label className="label">
            New Login Email

            <input
              className="input"
              name="newEmail"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <CurrentPasswordField />

          <button
            className="primary"
            type="submit"
          >
            Change Login Email
          </button>
        </form>
      ) : null}

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