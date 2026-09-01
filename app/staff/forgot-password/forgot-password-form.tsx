"use client";

import { useActionState } from "react";

import {
  requestStaffPasswordReset,
  type ForgotPasswordState,
} from "@/app/actions/password-reset";

const initialState: ForgotPasswordState = {
  ok: false,
  message: "",
};

export default function StaffForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestStaffPasswordReset,
    initialState,
  );

  return (
    <form action={action} className="panel form">
      <label className="label">
        Email address

        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </label>

      <button
        className="primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>

      {state.message ? (
        <p className={state.ok ? "success" : "alert"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
