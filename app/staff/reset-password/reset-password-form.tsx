"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  resetStaffPassword,
  type ResetPasswordState,
} from "@/app/actions/password-reset";

const initialState: ResetPasswordState = {
  ok: false,
  message: "",
};

export default function StaffResetPasswordForm({
  token,
}: {
  token: string;
}) {
  const [state, action, pending] = useActionState(
    resetStaffPassword,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="panel">
        <p className="success">{state.message}</p>

        <Link className="primary" href="/staff/login">
          Staff Sign In
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="panel form">
      <input type="hidden" name="token" value={token} />

      <label className="label">
        New password
        <input
          className="input"
          type="password"
          name="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </label>

      <label className="label">
        Confirm new password
        <input
          className="input"
          type="password"
          name="confirmPassword"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </label>

      <button
        className="primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Updating…" : "Reset Password"}
      </button>

      {state.message ? (
        <p className="alert">{state.message}</p>
      ) : null}
    </form>
  );
}